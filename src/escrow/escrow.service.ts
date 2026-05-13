import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DealStatus,
  EscrowEventActor,
  EscrowEventType,
  ListingStatus,
  Prisma,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type TradeQrPayload = {
  dealId: string;
  issuedBy: string;
  nonce: string;
  ts: number;
};

const ALLOWED_TRANSITIONS: Partial<Record<DealStatus, DealStatus[]>> = {
  [DealStatus.PENDING]: [DealStatus.FUNDS_LOCKED, DealStatus.CANCELLED],
  [DealStatus.FUNDS_LOCKED]: [
    DealStatus.DELIVERY_VERIFICATION_PENDING,
    DealStatus.COMPLETED,
    DealStatus.DISPUTED,
    DealStatus.CANCELLED,
  ],
  [DealStatus.DELIVERY_VERIFICATION_PENDING]: [
    DealStatus.FUNDS_LOCKED,
    DealStatus.COMPLETED,
    DealStatus.DISPUTED,
    DealStatus.CANCELLED,
  ],
};

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createDeal(
    buyerId: string,
    payload: { listingId: string; agreedAmount?: string; currency?: string },
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: payload.listingId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing no encontrado');
    }
    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new BadRequestException('El listing no esta publicado');
    }
    if (listing.ownerId === buyerId) {
      throw new BadRequestException('No puedes crear un deal sobre tu propio listing');
    }

    const agreedAmount = payload.agreedAmount
      ? new Prisma.Decimal(payload.agreedAmount)
      : listing.priceAmount;

    const deal = await this.prisma.$transaction(async tx => {
      const created = await tx.deal.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId: listing.ownerId,
          agreedAmount,
          currency: payload.currency ?? listing.priceCurrency,
          status: DealStatus.PENDING,
        },
        select: {
          id: true,
          listingId: true,
          buyerId: true,
          sellerId: true,
          agreedAmount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      });

      await tx.escrowEvent.create({
        data: {
          dealId: created.id,
          eventType: EscrowEventType.DEAL_CREATED,
          fromStatus: null,
          toStatus: DealStatus.PENDING,
          actorType: EscrowEventActor.BUYER,
          actorUserId: buyerId,
          metadata: {
            listingId: created.listingId,
            amount: created.agreedAmount.toString(),
            currency: created.currency,
          },
        },
      });

      return created;
    });

    await this.notificationsService.notifyDealStatusChange(
      deal.sellerId,
      deal.status,
      deal.id,
      'Nuevo trato creado. Revisa la solicitud en Mis Tratos.',
    );

    return {
      success: true,
      data: deal,
      message: 'Deal creado',
    };
  }

  async confirmPayment(dealId: string, buyerId: string) {
    return this.lockFunds(dealId, buyerId);
  }

  async lockFunds(dealId: string, buyerId: string) {
    const result = await this.prisma.$transaction(async tx => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) {
        throw new NotFoundException('Deal no encontrado');
      }

      if (deal.buyerId !== buyerId) {
        throw new ForbiddenException(
          'Solo el comprador del deal puede bloquear fondos',
        );
      }

      if (deal.status === DealStatus.FUNDS_LOCKED) {
        return {
          response: {
            success: true,
            data: {
              dealId: deal.id,
              status: deal.status,
              lockedAt: deal.lockedAt,
            },
            message: 'Fondos ya estaban bloqueados (idempotente)',
          },
          sellerId: deal.sellerId,
        };
      }

      this.assertTransition(deal.status, DealStatus.FUNDS_LOCKED, 'lock-funds');

      if (deal.status !== DealStatus.PENDING) {
        throw new BadRequestException(
          `El deal no esta en estado valido para bloquear fondos (${deal.status})`,
        );
      }

      const buyer = await tx.user.findUnique({ where: { id: buyerId } });
      if (!buyer) {
        throw new NotFoundException('Comprador no encontrado');
      }

      if (buyer.balance.lt(deal.agreedAmount)) {
        throw new BadRequestException('Balance insuficiente para bloquear fondos');
      }

      await tx.user.update({
        where: { id: buyerId },
        data: {
          balance: buyer.balance.minus(deal.agreedAmount),
        },
      });

      const updatedDeal = await tx.deal.update({
        where: { id: dealId },
        data: {
          status: DealStatus.FUNDS_LOCKED,
          lockedAt: new Date(),
        },
      });

      await tx.escrowEvent.create({
        data: {
          dealId: updatedDeal.id,
          eventType: EscrowEventType.FUNDS_LOCKED,
          fromStatus: deal.status,
          toStatus: DealStatus.FUNDS_LOCKED,
          actorType: EscrowEventActor.BUYER,
          actorUserId: buyerId,
          metadata: {
            amount: deal.agreedAmount.toString(),
            buyerBalanceBefore: buyer.balance.toString(),
            buyerBalanceAfter: buyer.balance.minus(deal.agreedAmount).toString(),
          },
        },
      });

      const response = {
        success: true,
        data: {
          dealId: updatedDeal.id,
          status: updatedDeal.status,
          lockedAt: updatedDeal.lockedAt,
        },
        message: 'Fondos bloqueados en custodia',
      };

      return { response, sellerId: deal.sellerId };
    });

    await this.notificationsService.notifyDealStatusChange(
      result.sellerId,
      result.response.data.status,
      result.response.data.dealId,
      'El comprador confirmo pago. Fondos en custodia activa.',
    );

    return result.response;
  }

  async getDealStatus(dealId: string, requesterId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        agreedAmount: true,
        currency: true,
        lockedAt: true,
        completedAt: true,
        disputedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }

    const isParticipant =
      deal.buyerId === requesterId || deal.sellerId === requesterId;
    if (!isParticipant) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden consultar el estatus',
      );
    }

    return {
      success: true,
      data: deal,
      message: 'Estatus del deal',
    };
  }

  async listDealsForUser(userId: string, status?: DealStatus) {
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        listingId: true,
        status: true,
        agreedAmount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: deals,
      message: 'Deals del usuario',
    };
  }

  async getDealTimeline(dealId: string, requesterId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }
    const isParticipant =
      deal.buyerId === requesterId || deal.sellerId === requesterId;
    if (!isParticipant) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden consultar timeline',
      );
    }

    const events = await this.prisma.escrowEvent.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        fromStatus: true,
        toStatus: true,
        actorType: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: {
        dealId,
        events,
      },
      message: 'Timeline del deal',
    };
  }

  async getDealDeliveryStatus(dealId: string, requesterId: string) {
    const raw = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
        agreedAmount: true,
        currency: true,
        lockedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    if (!raw) {
      throw new NotFoundException('Deal no encontrado');
    }
    const isParticipant =
      raw.buyerId === requesterId || raw.sellerId === requesterId;
    if (!isParticipant) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden consultar estado de entrega',
      );
    }

    await this.recoverExpiredDeliveryStatus(
      this.prisma,
      raw.id,
      raw.status,
    );

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        status: true,
        agreedAmount: true,
        currency: true,
        lockedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }

    const activeToken = await this.prisma.deliveryToken.findFirst({
      where: {
        dealId,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        expiresAt: true,
        issuedByUserId: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: {
        dealId,
        status: deal.status,
        agreedAmount: deal.agreedAmount.toString(),
        currency: deal.currency,
        lockedAt: deal.lockedAt,
        completedAt: deal.completedAt,
        updatedAt: deal.updatedAt,
        hasActiveToken: Boolean(activeToken),
        activeToken,
      },
      message: 'Estado de entrega / QR activo',
    };
  }

  async generateTradeQR(dealId: string, requesterId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }

    const isParticipant =
      deal.buyerId === requesterId || deal.sellerId === requesterId;
    if (!isParticipant) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden generar QR',
      );
    }

    const normalizedStatus = await this.recoverExpiredDeliveryStatus(
      this.prisma,
      deal.id,
      deal.status,
    );

    this.assertTransition(
      normalizedStatus,
      DealStatus.DELIVERY_VERIFICATION_PENDING,
      'generate-trade-qr',
    );

    if (normalizedStatus !== DealStatus.FUNDS_LOCKED) {
      throw new BadRequestException(
        `El deal no esta en estado valido para generar QR (${normalizedStatus})`,
      );
    }

    const nonce = randomUUID();
    const payload: TradeQrPayload = {
      dealId: deal.id,
      issuedBy: requesterId,
      nonce,
      ts: Date.now(),
    };

    const tradeToken = await this.jwtService.signAsync(payload, {
      expiresIn: '5m',
    });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const tokenHash = this.hashTradeToken(tradeToken);

    await this.prisma.$transaction(async tx => {
      const invalidatedTokens = await tx.deliveryToken.updateMany({
        where: {
          dealId: deal.id,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          // Solo permitimos un token QR activo por deal.
          expiresAt: new Date(),
        },
      });

      await tx.deliveryToken.create({
        data: {
          dealId: deal.id,
          tokenHash,
          issuedByUserId: requesterId,
          expiresAt,
        },
      });

      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.DELIVERY_VERIFICATION_PENDING,
        },
      });

      await tx.escrowEvent.create({
        data: {
          dealId: deal.id,
          eventType: EscrowEventType.DELIVERY_TOKEN_GENERATED,
          fromStatus: normalizedStatus,
          toStatus: updatedDeal.status,
          actorType: requesterId === deal.buyerId ? EscrowEventActor.BUYER : EscrowEventActor.SELLER,
          actorUserId: requesterId,
          metadata: {
            expiresAt: expiresAt.toISOString(),
            nonce,
            invalidatedPreviousTokens: invalidatedTokens.count,
          },
        },
      });
    });

    return {
      success: true,
      data: {
        tradeToken,
        expiresInSeconds: 300,
      },
      message: 'Token QR generado',
    };
  }

  async releaseFunds(tradeToken: string, scannerUserId: string) {
    let payload: TradeQrPayload;
    try {
      payload = await this.jwtService.verifyAsync<TradeQrPayload>(tradeToken);
    } catch {
      throw new UnauthorizedException('Token QR inválido o expirado');
    }

    const result = await this.prisma.$transaction(async tx => {
      const rawDeal = await tx.deal.findUnique({ where: { id: payload.dealId } });
      if (!rawDeal) {
        throw new NotFoundException('Deal no encontrado');
      }
      const normalizedStatus = await this.recoverExpiredDeliveryStatus(
        tx,
        rawDeal.id,
        rawDeal.status,
      );
      const deal = { ...rawDeal, status: normalizedStatus };

      this.assertTransition(deal.status, DealStatus.COMPLETED, 'release-funds');

      if (deal.status === DealStatus.COMPLETED) {
        return {
          response: {
            success: true,
            data: {
              dealId: deal.id,
              status: deal.status,
              completedAt: deal.completedAt,
            },
            message: 'Fondos ya estaban liberados (idempotente)',
          },
          buyerId: deal.buyerId,
          sellerId: deal.sellerId,
        };
      }

      if (
        deal.status !== DealStatus.FUNDS_LOCKED &&
        deal.status !== DealStatus.DELIVERY_VERIFICATION_PENDING
      ) {
        throw new BadRequestException(
          `El deal no esta listo para liberar fondos (${deal.status})`,
        );
      }

      if (scannerUserId !== deal.sellerId) {
        throw new ForbiddenException(
          'Solo el vendedor/técnico puede confirmar y liberar fondos',
        );
      }

      if (payload.issuedBy === scannerUserId) {
        throw new ForbiddenException(
          'El token debe ser escaneado por la contraparte, no por quien lo generó',
        );
      }

      const tokenHash = this.hashTradeToken(tradeToken);
      const deliveryToken = await tx.deliveryToken.findUnique({
        where: { tokenHash },
      });
      if (!deliveryToken || deliveryToken.dealId !== deal.id) {
        throw new UnauthorizedException('Token QR no reconocido para este deal');
      }
      if (deliveryToken.usedAt) {
        throw new BadRequestException('Token QR ya fue utilizado');
      }
      if (deliveryToken.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Token QR expirado');
      }

      const seller = await tx.user.findUnique({ where: { id: deal.sellerId } });
      if (!seller) {
        throw new NotFoundException('Vendedor/técnico no encontrado');
      }

      await tx.user.update({
        where: { id: seller.id },
        data: {
          balance: seller.balance.plus(deal.agreedAmount),
        },
      });
      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.deliveryToken.update({
        where: { id: deliveryToken.id },
        data: {
          usedAt: new Date(),
          usedByUserId: scannerUserId,
        },
      });

      await tx.escrowEvent.createMany({
        data: [
          {
            dealId: deal.id,
            eventType: EscrowEventType.DELIVERY_CONFIRMED,
            fromStatus: deal.status,
            toStatus: DealStatus.COMPLETED,
            actorType: EscrowEventActor.SELLER,
            actorUserId: scannerUserId,
            metadata: {
              tokenId: deliveryToken.id,
              issuedByUserId: payload.issuedBy,
            },
          },
          {
            dealId: deal.id,
            eventType: EscrowEventType.FUNDS_RELEASED,
            fromStatus: deal.status,
            toStatus: DealStatus.COMPLETED,
            actorType: EscrowEventActor.SYSTEM,
            actorUserId: scannerUserId,
            metadata: {
              amount: deal.agreedAmount.toString(),
              currency: deal.currency,
              sellerId: deal.sellerId,
            },
          },
        ],
      });

      const response = {
        success: true,
        data: {
          dealId: updatedDeal.id,
          status: updatedDeal.status,
          completedAt: updatedDeal.completedAt,
        },
        message: 'Fondos liberados al vendedor/técnico',
      };
      return { response, buyerId: deal.buyerId, sellerId: deal.sellerId };
    });

    await this.notificationsService.notifyDealStatusChange(
      result.buyerId,
      result.response.data.status,
      result.response.data.dealId,
      'Tu trato fue completado y los fondos fueron liberados.',
    );
    await this.notificationsService.notifyDealStatusChange(
      result.sellerId,
      result.response.data.status,
      result.response.data.dealId,
      'Fondos recibidos en tu balance disponible.',
    );

    return result.response;
  }

  async listDealMessages(dealId: string, requesterId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }
    if (deal.buyerId !== requesterId && deal.sellerId !== requesterId) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden ver el chat',
      );
    }

    const messages = await this.prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        actionKey: true,
        createdAt: true,
        author: { select: { id: true, email: true, name: true } },
      },
    });

    return {
      success: true,
      data: { dealId, messages },
      message: 'Mensajes del deal',
    };
  }

  async postDealMessage(
    dealId: string,
    requesterId: string,
    payload: { body: string; actionKey?: string },
  ) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }
    if (deal.buyerId !== requesterId && deal.sellerId !== requesterId) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden escribir en el chat',
      );
    }

    const actorType =
      requesterId === deal.buyerId
        ? EscrowEventActor.BUYER
        : EscrowEventActor.SELLER;

    const trimmedBody = payload.body.trim();
    const actionKey = payload.actionKey?.trim() || null;

    const created = await this.prisma.$transaction(async tx => {
      const msg = await tx.dealMessage.create({
        data: {
          dealId,
          authorId: requesterId,
          body: trimmedBody,
          actionKey: actionKey ?? undefined,
        },
        select: {
          id: true,
          body: true,
          actionKey: true,
          createdAt: true,
          author: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.escrowEvent.create({
        data: {
          dealId,
          eventType: EscrowEventType.CHAT_MESSAGE,
          fromStatus: deal.status,
          toStatus: deal.status,
          actorType,
          actorUserId: requesterId,
          metadata: {
            messageId: msg.id,
            preview: trimmedBody.slice(0, 200),
            actionKey: actionKey ?? undefined,
          },
        },
      });

      return msg;
    });

    return {
      success: true,
      data: created,
      message: 'Mensaje registrado',
    };
  }

  async postDealProximity(
    dealId: string,
    requesterId: string,
    payload: { latitude: number; longitude: number; accuracyM?: number },
  ) {
    const raw = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!raw) {
      throw new NotFoundException('Deal no encontrado');
    }
    if (raw.buyerId !== requesterId && raw.sellerId !== requesterId) {
      throw new ForbiddenException(
        'Solo participantes del deal pueden registrar proximidad',
      );
    }

    await this.recoverExpiredDeliveryStatus(this.prisma, raw.id, raw.status);
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { status: true },
    });
    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }

    const actorType =
      requesterId === raw.buyerId
        ? EscrowEventActor.BUYER
        : EscrowEventActor.SELLER;

    await this.prisma.escrowEvent.create({
      data: {
        dealId,
        eventType: EscrowEventType.PROXIMITY_HINT,
        fromStatus: deal.status,
        toStatus: deal.status,
        actorType,
        actorUserId: requesterId,
        metadata: {
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyM: payload.accuracyM ?? undefined,
          note:
            'Evento de apoyo UX; no certifica entrega. La entrega se valida con QR.',
        },
      },
    });

    return {
      success: true,
      data: {
        dealId,
        status: deal.status,
      },
      message: 'Proximidad registrada en timeline',
    };
  }

  private assertTransition(
    fromStatus: DealStatus,
    toStatus: DealStatus,
    action: string,
  ) {
    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus) && fromStatus !== toStatus) {
      throw new BadRequestException(
        `Transicion invalida (${fromStatus} -> ${toStatus}) en ${action}`,
      );
    }
  }

  private hashTradeToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recoverExpiredDeliveryStatus(
    tx: PrismaService | Prisma.TransactionClient,
    dealId: string,
    currentStatus: DealStatus,
  ) {
    if (currentStatus !== DealStatus.DELIVERY_VERIFICATION_PENDING) {
      return currentStatus;
    }

    const activeToken = await tx.deliveryToken.findFirst({
      where: {
        dealId,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });
    if (activeToken) {
      return currentStatus;
    }

    await tx.deal.update({
      where: { id: dealId },
      data: { status: DealStatus.FUNDS_LOCKED },
    });
    await tx.escrowEvent.create({
      data: {
        dealId,
        eventType: EscrowEventType.DELIVERY_TOKEN_EXPIRED,
        fromStatus: DealStatus.DELIVERY_VERIFICATION_PENDING,
        toStatus: DealStatus.FUNDS_LOCKED,
        actorType: EscrowEventActor.SYSTEM,
        metadata: { reason: 'No hay tokens QR activos' },
      },
    });

    return DealStatus.FUNDS_LOCKED;
  }
}

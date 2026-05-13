import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TopUpRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopUpRequestDto } from './dto/create-topup-request.dto';
import { ReviewTopUpRequestDto } from './dto/review-topup-request.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTopUpRequest(userId: string, dto: CreateTopUpRequestDto) {
    const created = await this.prisma.topUpRequest.create({
      data: {
        userId,
        provider: dto.provider,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency.toUpperCase(),
        receiptUrl: dto.receiptUrl,
        paymentRef: dto.paymentRef,
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: created,
      message: 'Solicitud de recarga creada, pendiente de validación',
    };
  }

  async getMyTopUpRequests(userId: string) {
    const requests = await this.prisma.topUpRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: requests,
      message: 'Solicitudes del usuario',
    };
  }

  async getAllTopUpRequests() {
    const requests = await this.prisma.topUpRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: requests,
      message: 'Solicitudes de recarga',
    };
  }

  async reviewTopUpRequest(
    id: string,
    dto: ReviewTopUpRequestDto,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async tx => {
      const request = await tx.topUpRequest.findUnique({ where: { id } });
      if (!request) {
        throw new NotFoundException('Solicitud no encontrada');
      }

      if (request.status !== TopUpRequestStatus.PENDING) {
        throw new BadRequestException('La solicitud ya fue procesada');
      }

      if (dto.approve) {
        await tx.user.update({
          where: { id: request.userId },
          data: {
            balance: {
              increment: request.amount,
            },
          },
        });

        const approved = await tx.topUpRequest.update({
          where: { id: request.id },
          data: {
            status: TopUpRequestStatus.APPROVED,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            rejectionReason: null,
          },
        });

        return {
          success: true,
          data: approved,
          message: 'Recarga aprobada y saldo acreditado',
        };
      }

      if (!dto.rejectionReason?.trim()) {
        throw new BadRequestException(
          'Debes indicar rejectionReason al rechazar la solicitud',
        );
      }

      const rejected = await tx.topUpRequest.update({
        where: { id: request.id },
        data: {
          status: TopUpRequestStatus.REJECTED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason.trim(),
        },
      });

      return {
        success: true,
        data: rejected,
        message: 'Solicitud de recarga rechazada',
      };
    });
  }

  binanceWebhookPlaceholder() {
    return {
      success: true,
      data: {
        pending: true,
      },
      message:
        'Pendiente: integrar verificación de firma y procesamiento de Binance Pay webhook',
    };
  }
}

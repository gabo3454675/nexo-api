import { Injectable, NotFoundException } from '@nestjs/common';
import { DealStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, balance: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const lockedInDeals = await this.prisma.deal.aggregate({
      where: {
        buyerId: userId,
        status: DealStatus.FUNDS_LOCKED,
      },
      _sum: { agreedAmount: true },
    });
    const lockedBalance = lockedInDeals._sum.agreedAmount ?? user.balance.minus(user.balance);

    const activeDeals = await this.prisma.deal.count({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: DealStatus.FUNDS_LOCKED,
      },
    });

    return {
      success: true,
      data: {
        availableBalance: user.balance,
        lockedBalance,
        totalBalance: user.balance.plus(lockedBalance),
        activeDeals,
      },
      message: 'Resumen de billetera',
    };
  }
}

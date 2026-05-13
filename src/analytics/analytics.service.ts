import { Injectable } from '@nestjs/common';
import { DealStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly activeSessions = new Map<string, number>();
  private readonly sessionsSeenToday = new Set<string>();
  private readonly sessionTtlMs = 2 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  heartbeat(sessionId: string) {
    const now = Date.now();
    this.cleanupExpiredSessions(now);
    this.activeSessions.set(sessionId, now);
    this.sessionsSeenToday.add(sessionId);

    return {
      success: true,
      data: {
        activeVisitors: this.activeSessions.size,
      },
      message: 'Heartbeat registrado',
    };
  }

  async getRealtimeStats() {
    const now = Date.now();
    this.cleanupExpiredSessions(now);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { hourlyWindows, dailyWindows } = this.buildTimeWindows();

    const [
      totalUsers,
      newUsersToday,
      totalDeals,
      dealsLocked,
      dealsCompleted,
      dealsDisputed,
      dealsCompletedToday,
      publishedListings,
      completedVolumeAgg,
      usersTodayRecords,
      completedDealsTodayRecords,
      usersLastWeekRecords,
      completedDealsLastWeekRecords,
      shipmentDeals,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.deal.count(),
      this.prisma.deal.count({ where: { status: DealStatus.FUNDS_LOCKED } }),
      this.prisma.deal.count({ where: { status: DealStatus.COMPLETED } }),
      this.prisma.deal.count({ where: { status: DealStatus.DISPUTED } }),
      this.prisma.deal.count({
        where: { status: DealStatus.COMPLETED, completedAt: { gte: startOfDay } },
      }),
      this.prisma.listing.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.deal.aggregate({
        where: { status: DealStatus.COMPLETED },
        _sum: { agreedAmount: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: hourlyWindows[0].start } },
        select: { createdAt: true },
      }),
      this.prisma.deal.findMany({
        where: {
          status: DealStatus.COMPLETED,
          completedAt: { gte: hourlyWindows[0].start },
        },
        select: { completedAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: dailyWindows[0].start } },
        select: { createdAt: true },
      }),
      this.prisma.deal.findMany({
        where: {
          status: DealStatus.COMPLETED,
          completedAt: { gte: dailyWindows[0].start },
        },
        select: { completedAt: true },
      }),
      this.prisma.deal.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          currency: true,
          agreedAmount: true,
          createdAt: true,
          updatedAt: true,
          lockedAt: true,
          completedAt: true,
          listing: { select: { title: true } },
          buyer: { select: { email: true, name: true } },
          seller: { select: { email: true, name: true } },
        },
      }),
    ]);

    const todayHourly = hourlyWindows.map(window => ({
      slot: window.label,
      registrations: usersTodayRecords.filter(
        user => user.createdAt >= window.start && user.createdAt < window.end,
      ).length,
      completedEscrows: completedDealsTodayRecords.filter(
        deal => deal.completedAt && deal.completedAt >= window.start && deal.completedAt < window.end,
      ).length,
    }));

    const last7Days = dailyWindows.map(window => ({
      day: window.label,
      registrations: usersLastWeekRecords.filter(
        user => user.createdAt >= window.start && user.createdAt < window.end,
      ).length,
      completedEscrows: completedDealsLastWeekRecords.filter(
        deal => deal.completedAt && deal.completedAt >= window.start && deal.completedAt < window.end,
      ).length,
    }));

    return {
      success: true,
      data: {
        visitors: {
          activeNow: this.activeSessions.size,
          uniqueToday: this.sessionsSeenToday.size,
        },
        users: {
          total: totalUsers,
          registeredToday: newUsersToday,
        },
        escrow: {
          totalDeals,
          locked: dealsLocked,
          completed: dealsCompleted,
          disputed: dealsDisputed,
          completedToday: dealsCompletedToday,
        },
        marketplace: {
          publishedListings,
        },
        revenue: {
          completedVolumeUsd: completedVolumeAgg._sum.agreedAmount?.toString() ?? '0',
        },
        trends: {
          todayHourly,
          last7Days,
        },
        shipments: shipmentDeals.map(deal => ({
          id: deal.id,
          status: deal.status,
          title: deal.listing.title,
          amount: deal.agreedAmount.toString(),
          currency: deal.currency,
          buyer: deal.buyer.name ?? deal.buyer.email,
          seller: deal.seller.name ?? deal.seller.email,
          createdAt: deal.createdAt.toISOString(),
          lockedAt: deal.lockedAt?.toISOString() ?? null,
          completedAt: deal.completedAt?.toISOString() ?? null,
          updatedAt: deal.updatedAt.toISOString(),
        })),
        refreshedAt: new Date().toISOString(),
      },
      message: 'Estadisticas en tiempo real',
    };
  }

  private cleanupExpiredSessions(now: number) {
    for (const [sessionId, lastSeen] of this.activeSessions.entries()) {
      if (now - lastSeen > this.sessionTtlMs) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private buildTimeWindows() {
    const now = new Date();
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0);

    const hourlyWindows = Array.from({ length: 8 }).map((_, idx) => {
      const start = new Date(currentHourStart);
      start.setHours(currentHourStart.getHours() - (7 - idx));
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      const label = `${start.getHours().toString().padStart(2, '0')}:00`;
      return { start, end, label };
    });

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dailyWindows = Array.from({ length: 7 }).map((_, idx) => {
      const start = new Date(dayStart);
      start.setDate(dayStart.getDate() - (6 - idx));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      const label = start.toLocaleDateString('es-VE', { weekday: 'short' });
      return { start, end, label };
    });

    return { hourlyWindows, dailyWindows };
  }
}

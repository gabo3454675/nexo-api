import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus, ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { SearchListingsDto } from './dto/search-listings.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async searchListings(filters: SearchListingsDto) {
    const q = filters.q?.trim();
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.PUBLISHED,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.location ? { location: filters.location } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const listings = await this.prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        location: true,
        imageUrls: true,
        priceAmount: true,
        priceCurrency: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            trustScore: true,
            isKycVerified: true,
          },
        },
      },
    });

    return {
      success: true,
      data: listings,
      message: 'Catalogo de marketplace',
    };
  }

  async getListingDetail(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        location: true,
        imageUrls: true,
        priceAmount: true,
        priceCurrency: true,
        quantity: true,
        serviceUnit: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            trustScore: true,
            isKycVerified: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing no encontrado');
    }

    return {
      success: true,
      data: listing,
      message: 'Detalle de listing',
    };
  }

  async createDealFeedback(userId: string, dto: CreateFeedbackDto) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      select: {
        id: true,
        status: true,
        buyerId: true,
        sellerId: true,
      },
    });

    if (!deal) {
      throw new NotFoundException('Deal no encontrado');
    }
    if (deal.status !== DealStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se puede calificar cuando el escrow fue liberado',
      );
    }

    const isParticipant = deal.buyerId === userId || deal.sellerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('No participas en este deal');
    }

    const toUserId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    await this.prisma.dealFeedback.upsert({
      where: {
        dealId_fromUserId: {
          dealId: deal.id,
          fromUserId: userId,
        },
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
        toUserId,
      },
      create: {
        dealId: deal.id,
        fromUserId: userId,
        toUserId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    const ratingAgg = await this.prisma.dealFeedback.aggregate({
      where: { toUserId },
      _avg: { rating: true },
    });
    const trustScore = Math.round((ratingAgg._avg.rating ?? 0) * 20);
    await this.prisma.user.update({
      where: { id: toUserId },
      data: { trustScore },
    });

    return {
      success: true,
      data: {
        dealId: deal.id,
        ratedUserId: toUserId,
        rating: dto.rating,
        trustScore,
      },
      message: 'Feedback guardado',
    };
  }
}

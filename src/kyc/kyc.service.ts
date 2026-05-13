import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { KycWebhookDto } from './dto/kyc-webhook.dto';
import { KycUploadType, RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    const upload = await this.storageService.createPresignedUpload({
      userId,
      folder: dto.type === KycUploadType.PROFILE_PHOTO ? 'profiles' : 'kyc-documents',
      contentType: dto.contentType,
    });

    return {
      success: true,
      data: upload,
      message: 'URL de carga generada',
    };
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profileImageUrl: dto.profileImageUrl ?? user.profileImageUrl,
        kycDocumentUrl: dto.documentImageUrl ?? user.kycDocumentUrl,
        kycProviderRef: dto.providerRef ?? user.kycProviderRef,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
      },
      select: {
        id: true,
        accountStatus: true,
        isKycVerified: true,
        profileImageUrl: true,
        kycDocumentUrl: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'KYC enviado para revisión',
    };
  }

  async handleWebhook(secret: string | undefined, dto: KycWebhookDto) {
    const configuredSecret = process.env.KYC_WEBHOOK_SECRET;
    if (!configuredSecret || !secret || secret !== configuredSecret) {
      throw new ForbiddenException('Webhook no autorizado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalized = dto.status.trim().toUpperCase();
    if (!['APPROVED', 'REJECTED', 'BANNED', 'PENDING'].includes(normalized)) {
      throw new BadRequestException('Estatus KYC no soportado');
    }

    const data =
      normalized === 'APPROVED'
        ? { isKycVerified: true, accountStatus: AccountStatus.VERIFIED }
        : normalized === 'BANNED'
          ? { isKycVerified: false, accountStatus: AccountStatus.BANNED }
          : { isKycVerified: false, accountStatus: AccountStatus.PENDING_VERIFICATION };

    const updated = await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        ...data,
        kycProviderRef: dto.providerRef,
      },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        isKycVerified: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Webhook KYC procesado',
    };
  }
}

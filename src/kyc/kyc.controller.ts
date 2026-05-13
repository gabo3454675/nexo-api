import {
  Body,
  Controller,
  Headers,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycWebhookDto } from './dto/kyc-webhook.dto';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generar URL firmada para subir selfie/documento' })
  requestUploadUrl(
    @Body() dto: RequestUploadUrlDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.kycService.requestUploadUrl(req.user.id, dto);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar referencias de KYC para validación' })
  submitKyc(@Body() dto: SubmitKycDto, @Request() req: AuthenticatedRequest) {
    return this.kycService.submitKyc(req.user.id, dto);
  }

  @Post('webhooks/facial-status')
  @ApiOperation({ summary: 'Webhook para resultado de validación facial KYC' })
  webhook(
    @Body() dto: KycWebhookDto,
    @Headers('x-kyc-webhook-secret') secret: string | undefined,
  ) {
    return this.kycService.handleWebhook(secret, dto);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DealStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EscrowService } from './escrow.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { GenerateTradeQrDto } from './dto/generate-trade-qr.dto';
import { LockFundsDto } from './dto/lock-funds.dto';
import { PostDealMessageDto } from './dto/post-deal-message.dto';
import { PostDealProximityDto } from './dto/post-deal-proximity.dto';
import { ReleaseFundsDto } from './dto/release-funds.dto';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Escrow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create-deal')
  @ApiOperation({ summary: 'Crear un nuevo deal desde un listing' })
  createDeal(@Body() dto: CreateDealDto, @Request() req: AuthenticatedRequest) {
    return this.escrowService.createDeal(req.user.id, dto);
  }

  @Get('deals')
  @ApiOperation({ summary: 'Listar deals del usuario autenticado' })
  listDeals(
    @Query('status') status: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const normalizedStatus = status?.trim().toUpperCase();
    const parsedStatus =
      normalizedStatus && (Object.values(DealStatus) as string[]).includes(normalizedStatus)
        ? (normalizedStatus as DealStatus)
        : undefined;

    return this.escrowService.listDealsForUser(req.user.id, parsedStatus);
  }

  @Get('deals/:dealId/delivery-status')
  @ApiOperation({
    summary: 'Estado de entrega: deal + token QR activo (si existe)',
  })
  getDealDeliveryStatus(
    @Param('dealId') dealId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.getDealDeliveryStatus(dealId, req.user.id);
  }

  @Get('deals/:dealId/timeline')
  @ApiOperation({ summary: 'Obtener timeline auditable de un deal' })
  getDealTimeline(
    @Param('dealId') dealId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.getDealTimeline(dealId, req.user.id);
  }

  @Get('deals/:dealId/messages')
  @ApiOperation({ summary: 'Listar mensajes del chat del deal' })
  listDealMessages(
    @Param('dealId') dealId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.listDealMessages(dealId, req.user.id);
  }

  @Post('deals/:dealId/messages')
  @ApiOperation({ summary: 'Enviar mensaje al chat del deal (auditoría en timeline)' })
  postDealMessage(
    @Param('dealId') dealId: string,
    @Body() dto: PostDealMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.postDealMessage(dealId, req.user.id, dto);
  }

  @Post('deals/:dealId/proximity')
  @ApiOperation({
    summary:
      'Registrar pista de proximidad (UX); aparece en timeline, no certifica entrega',
  })
  postDealProximity(
    @Param('dealId') dealId: string,
    @Body() dto: PostDealProximityDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.postDealProximity(dealId, req.user.id, dto);
  }

  @Get('deals/:dealId')
  @ApiOperation({ summary: 'Obtener estatus de un deal' })
  getDealStatus(
    @Param('dealId') dealId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.getDealStatus(dealId, req.user.id);
  }

  @Post('lock-funds')
  @ApiOperation({ summary: 'Bloquear fondos del comprador en custodia' })
  lockFunds(@Body() dto: LockFundsDto, @Request() req: AuthenticatedRequest) {
    return this.escrowService.lockFunds(dto.dealId, req.user.id);
  }

  @Post('confirm-payment')
  @ApiOperation({ summary: 'Confirmar pago y mover fondos a custodia' })
  confirmPayment(
    @Body() dto: ConfirmPaymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.confirmPayment(dto.dealId, req.user.id);
  }

  @Post('generate-trade-qr')
  @ApiOperation({ summary: 'Generar token QR firmado para el intercambio' })
  generateTradeQR(
    @Body() dto: GenerateTradeQrDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.generateTradeQR(dto.dealId, req.user.id);
  }

  @Post('release-funds')
  @ApiOperation({ summary: 'Liberar fondos al vendedor/técnico desde token QR' })
  releaseFunds(
    @Body() dto: ReleaseFundsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.releaseFunds(dto.tradeToken, req.user.id);
  }
}

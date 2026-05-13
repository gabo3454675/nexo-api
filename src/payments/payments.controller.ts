import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTopUpRequestDto } from './dto/create-topup-request.dto';
import { ReviewTopUpRequestDto } from './dto/review-topup-request.dto';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('top-up-requests')
  @ApiOperation({ summary: 'Crear solicitud de recarga por comprobante' })
  @UseGuards(JwtAuthGuard)
  createTopUpRequest(
    @Body() dto: CreateTopUpRequestDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.createTopUpRequest(req.user.id, dto);
  }

  @Get('top-up-requests/my')
  @ApiOperation({ summary: 'Listar solicitudes del usuario autenticado' })
  @UseGuards(JwtAuthGuard)
  getMyTopUpRequests(@Request() req: AuthenticatedRequest) {
    return this.paymentsService.getMyTopUpRequests(req.user.id);
  }

  @Get('top-up-requests')
  @ApiOperation({ summary: 'Listar todas las solicitudes (admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAllTopUpRequests(@Request() req: AuthenticatedRequest) {
    return this.paymentsService.getAllTopUpRequests();
  }

  @Post('top-up-requests/:id/review')
  @ApiOperation({ summary: 'Aprobar/Rechazar recarga (admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  reviewTopUpRequest(
    @Param('id') id: string,
    @Body() dto: ReviewTopUpRequestDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.reviewTopUpRequest(id, dto, req.user.id);
  }

  @Post('webhooks/binance-pay')
  @ApiOperation({ summary: 'Placeholder webhook Binance Pay (pendiente)' })
  binanceWebhookPlaceholder() {
    return this.paymentsService.binanceWebhookPlaceholder();
  }
}

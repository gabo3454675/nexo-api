import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de billetera del usuario autenticado' })
  getSummary(@Request() req: AuthenticatedRequest) {
    return this.walletService.getSummary(req.user.id);
  }
}

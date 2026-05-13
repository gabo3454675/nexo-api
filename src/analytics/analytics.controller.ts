import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TrackVisitDto } from './dto/track-visit.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('heartbeat')
  @ApiOperation({ summary: 'Registrar sesion activa para metricas de visita' })
  trackVisit(@Body() dto: TrackVisitDto) {
    return this.analyticsService.heartbeat(dto.sessionId);
  }

  @Get('realtime')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Dashboard en tiempo real para super admin' })
  getRealtimeStats() {
    return this.analyticsService.getRealtimeStats();
  }

  @Get('realtime-dev')
  @ApiOperation({ summary: 'Dashboard admin sin auth (solo desarrollo)' })
  getRealtimeStatsDev() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint disponible solo en desarrollo');
    }
    return this.analyticsService.getRealtimeStats();
  }
}

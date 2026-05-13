import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { MarketplaceService } from './marketplace.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('listings')
  @ApiOperation({
    summary:
      'Catalogo y busqueda de listings con filtros por categoria, ubicacion y tipo',
  })
  searchListings(@Query() query: SearchListingsDto) {
    return this.marketplaceService.searchListings(query);
  }

  @Get('listings/:listingId')
  @ApiOperation({ summary: 'Detalle de producto/servicio del marketplace' })
  getListingDetail(@Param('listingId') listingId: string) {
    return this.marketplaceService.getListingDetail(listingId);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Calificar contraparte luego de liberar el escrow' })
  createFeedback(@Body() dto: CreateFeedbackDto, @Request() req: AuthenticatedRequest) {
    return this.marketplaceService.createDealFeedback(req.user.id, dto);
  }
}

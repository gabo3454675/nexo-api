import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingLocation, ListingType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SearchListingsDto {
  @ApiPropertyOptional({ enum: ListingType, example: ListingType.PRODUCT })
  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @ApiPropertyOptional({ example: 'Hogar Tech' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ListingLocation, example: ListingLocation.CARACAS })
  @IsOptional()
  @IsEnum(ListingLocation)
  location?: ListingLocation;

  @ApiPropertyOptional({ example: 'iphone' })
  @IsOptional()
  @IsString()
  q?: string;
}

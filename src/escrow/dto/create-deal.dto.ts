import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateDealDto {
  @ApiProperty({ example: 'clxlisting1234567890' })
  @IsString()
  listingId!: string;

  @ApiPropertyOptional({ example: '120.00' })
  @IsOptional()
  @IsString()
  agreedAmount?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

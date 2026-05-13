import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PostDealProximityDto {
  @ApiProperty({ example: 10.4969 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -66.8983 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ description: 'Precision aproximada en metros' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  accuracyM?: number;
}

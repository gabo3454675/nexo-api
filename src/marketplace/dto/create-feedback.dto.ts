import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ example: 'cmf4xdeal123' })
  @IsString()
  dealId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Excelente servicio y entrega puntual.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

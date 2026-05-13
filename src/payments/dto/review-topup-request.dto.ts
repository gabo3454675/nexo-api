import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewTopUpRequestDto {
  @ApiProperty({ example: true, description: 'true=aprobar, false=rechazar' })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({
    example: 'Comprobante ilegible o no coincide con monto',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

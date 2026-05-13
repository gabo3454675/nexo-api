import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PostDealMessageDto {
  @ApiProperty({ example: 'Listo para encontrarnos en la entrada.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({
    example: 'REQUEST_QR',
    description: 'Clave opcional de accion contextual (boton)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actionKey?: string;
}

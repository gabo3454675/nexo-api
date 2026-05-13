import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReleaseFundsDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token firmado para confirmar intercambio',
  })
  @IsString()
  tradeToken!: string;
}

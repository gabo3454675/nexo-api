import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LockFundsDto {
  @ApiProperty({ example: 'clxdeal1234567890' })
  @IsString()
  dealId!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class KycWebhookDto {
  @ApiProperty({ example: 'clxuser123456789' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'APPROVED' })
  @IsString()
  status!: string;

  @ApiProperty({ example: 'provider-job-123456' })
  @IsString()
  providerRef!: string;
}

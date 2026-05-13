import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum KycUploadType {
  PROFILE_PHOTO = 'PROFILE_PHOTO',
  KYC_DOCUMENT = 'KYC_DOCUMENT',
}

export class RequestUploadUrlDto {
  @ApiProperty({ enum: KycUploadType })
  @IsEnum(KycUploadType)
  type!: KycUploadType;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType!: string;
}

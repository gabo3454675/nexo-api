import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitKycDto {
  @ApiPropertyOptional({
    example: 'https://my-bucket.s3.us-east-1.amazonaws.com/profiles/user123/a.jpg',
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    example:
      'https://my-bucket.s3.us-east-1.amazonaws.com/kyc-documents/user123/doc.jpg',
  })
  @IsOptional()
  @IsString()
  documentImageUrl?: string;

  @ApiPropertyOptional({ example: 'provider-job-123456' })
  @IsOptional()
  @IsString()
  providerRef?: string;
}

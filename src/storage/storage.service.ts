import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.AWS_S3_BUCKET ?? '';
  private readonly region = process.env.AWS_REGION ?? 'us-east-1';
  private readonly baseUrl =
    process.env.AWS_S3_BASE_URL ??
    (this.bucket ? `https://${this.bucket}.s3.${this.region}.amazonaws.com` : '');

  private readonly client = new S3Client({
    region: this.region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  async createPresignedUpload(input: {
    userId: string;
    folder: 'profiles' | 'kyc-documents';
    contentType: string;
  }) {
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'Falta configurar AWS_S3_BUCKET para uploads',
      );
    }

    const extension = this.extensionFromContentType(input.contentType);
    const key = `${input.folder}/${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 60 * 5,
    });

    return {
      key,
      uploadUrl,
      fileUrl: `${this.baseUrl}/${key}`,
      expiresInSeconds: 300,
    };
  }

  private extensionFromContentType(contentType: string) {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('webp')) return 'webp';
    return 'jpg';
  }
}

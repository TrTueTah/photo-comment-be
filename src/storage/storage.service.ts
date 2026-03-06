import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION ?? 'ap-southeast-1';
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async generatePresignedUrl(
    filename: string,
    contentType: string,
  ): Promise<{ presignedUrl: string; key: string }> {
    const ext = extname(filename) || '.jpg';
    const key = `photos/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300,
    });

    return { presignedUrl, key };
  }

  async getPresignedViewUrl(keyOrUrl: string): Promise<string> {
    const key = keyOrUrl.startsWith('http')
      ? new URL(keyOrUrl).pathname.slice(1)
      : keyOrUrl;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}

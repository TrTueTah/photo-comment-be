import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';
import { PresignPhotoDto } from './dto/presign-photo.dto';

@Injectable()
export class PhotosService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async presignUpload(dto: PresignPhotoDto) {
    const { presignedUrl, key } = await this.storage.generatePresignedUrl(
      dto.filename,
      dto.contentType,
    );
    return { presignedUrl, key, expiresIn: 300 };
  }

  async confirmUpload(userId: string, dto: ConfirmPhotoDto) {
    const photo = await this.prisma.photo.create({
      data: { userId, url: dto.key, caption: dto.caption },
      include: { user: { select: { id: true, name: true } } },
    });
    const url = await this.storage.getPresignedViewUrl(photo.url);
    return {
      id: photo.id,
      url,
      caption: photo.caption,
      createdAt: photo.createdAt,
      uploader: photo.user,
    };
  }

  async findOne(id: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    const url = await this.storage.getPresignedViewUrl(photo.url);
    return {
      id: photo.id,
      url,
      caption: photo.caption,
      createdAt: photo.createdAt,
      uploader: photo.user,
      commentCount: photo._count.comments,
    };
  }

  async findAll() {
    const photos = await this.prisma.photo.findMany({
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        url: await this.storage.getPresignedViewUrl(p.url),
        caption: p.caption,
        createdAt: p.createdAt,
        uploader: p.user,
        commentCount: p._count.comments,
      })),
    );
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, photoId: string, dto: CreateCommentDto) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    const content = dto.content.trim();
    const comment = await this.prisma.comment.create({
      data: { userId, photoId, content },
      include: { user: { select: { id: true, name: true } } },
    });
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.user,
    };
  }

  async findByPhotoId(photoId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    const comments = await this.prisma.comment.findMany({
      where: { photoId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: c.user,
    }));
  }
}

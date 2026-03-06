import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { PhotosModule } from './photos/photos.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, PhotosModule, CommentsModule],
})
export class AppModule {}

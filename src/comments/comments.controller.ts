import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

interface RequestWithUser extends Request {
  user: { id: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('photos/:photoId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  create(
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Request() req: RequestWithUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(req.user.id, photoId, dto);
  }

  @Get()
  findAll(@Param('photoId', ParseUUIDPipe) photoId: string) {
    return this.commentsService.findByPhotoId(photoId);
  }
}

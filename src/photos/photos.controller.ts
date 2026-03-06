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
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import { PhotosService } from './photos.service';

interface RequestWithUser extends Request {
  user: { id: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('photos')
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  @Post('presign')
  presign(@Body() dto: PresignPhotoDto) {
    return this.photosService.presignUpload(dto);
  }

  @Post()
  confirmUpload(@Request() req: RequestWithUser, @Body() dto: ConfirmPhotoDto) {
    return this.photosService.confirmUpload(req.user.id, dto);
  }

  @Get()
  findAll() {
    return this.photosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.photosService.findOne(id);
  }
}

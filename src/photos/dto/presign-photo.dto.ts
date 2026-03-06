import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class PresignPhotoDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  contentType: string;
}

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmPhotoDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}

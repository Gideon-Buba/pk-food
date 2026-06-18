import { IsEnum, IsString, MinLength } from 'class-validator';
import { AnnouncementType } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsEnum(AnnouncementType)
  type!: AnnouncementType;

  @IsString()
  @MinLength(1)
  message!: string;
}

import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Floor } from '@prisma/client';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+234\d{10}$/, { message: 'Phone must be in the format +234XXXXXXXXXX' })
  phone?: string;

  @IsOptional()
  @IsEnum(Floor, { message: 'Select a valid floor (GF or F1–F16)' })
  floor?: Floor;

  @IsOptional()
  @IsString()
  officeNumber?: string;
}

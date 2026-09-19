import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ItemStatus } from '@prisma/client';

export class UpdateSideDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsEnum(ItemStatus)
  @IsOptional()
  status?: ItemStatus;
}

import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { FoodCategory, ItemStatus } from '@prisma/client';

export class UpdateMenuItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalStock?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  onlineStock?: number;

  @IsEnum(ItemStatus)
  @IsOptional()
  status?: ItemStatus;

  @IsEnum(FoodCategory)
  @IsOptional()
  category?: FoodCategory;
}

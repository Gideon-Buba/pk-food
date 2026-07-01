import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Floor } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsEnum(Floor, { message: 'Select a valid floor (GF or F1–F16)' })
  floor!: Floor;

  @IsString()
  @IsNotEmpty()
  officeNumber!: string;

  @IsString()
  @Matches(/^(\+?234|0)[789]\d{9}$/, { message: 'Enter a valid Nigerian phone number' })
  phone!: string;
}

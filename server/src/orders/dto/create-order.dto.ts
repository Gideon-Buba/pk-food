import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsString()
  @IsNotEmpty()
  floor!: string;

  @IsString()
  @IsNotEmpty()
  officeNumber!: string;

  @IsString()
  @Matches(/^(\+?234|0)[789]\d{9}$/, { message: 'Enter a valid Nigerian phone number' })
  phone!: string;
}

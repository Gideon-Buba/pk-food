import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetMenuItemSidesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  sideIds!: string[];
}

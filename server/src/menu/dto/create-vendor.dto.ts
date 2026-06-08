import { IsNotEmpty, IsString } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+234\d{10}$/, { message: 'Phone must be in the format +234XXXXXXXXXX' })
  phone?: string;
}

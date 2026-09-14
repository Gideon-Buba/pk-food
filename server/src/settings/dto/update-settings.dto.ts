import { IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt()
  @Min(0)
  packagingFee!: number;
}

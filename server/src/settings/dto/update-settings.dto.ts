import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  packagingFee?: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'openTime must be in HH:mm 24h format' })
  @IsOptional()
  openTime?: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'closeTime must be in HH:mm 24h format' })
  @IsOptional()
  closeTime?: string;

  @IsInt()
  @Min(0)
  @Max(90)
  @IsOptional()
  discountPercent?: number;
}

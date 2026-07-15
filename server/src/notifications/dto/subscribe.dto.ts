import { IsString, IsUrl } from 'class-validator';

export class SubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class UnsubscribeDto {
  @IsString()
  endpoint!: string;
}

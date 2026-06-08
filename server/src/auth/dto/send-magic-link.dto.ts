import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendMagicLinkDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitBankTransferDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsString()
  transferReference?: string;
}

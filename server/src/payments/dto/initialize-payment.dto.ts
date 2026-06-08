import { IsNotEmpty, IsString } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}

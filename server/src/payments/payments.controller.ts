import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PaymentsService, PaystackInitData } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  async initialize(
    @CurrentUser() user: User,
    @Body() dto: InitializePaymentDto,
  ): Promise<{ data: PaystackInitData; message: string }> {
    const data = await this.paymentsService.initializePayment(user.id, dto);
    return { data, message: 'Payment initialized' };
  }

  @Get('verify/:reference')
  async verify(@Param('reference') reference: string) {
    const data = await this.paymentsService.verifyPayment(reference);
    return { data, message: data.paid ? 'Payment verified' : 'Payment not confirmed' };
  }
}

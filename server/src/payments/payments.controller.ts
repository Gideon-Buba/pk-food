import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PaymentsService, FlutterwaveInitData, BankDetails } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { SubmitBankTransferDto } from './dto/submit-bank-transfer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  async initialize(
    @CurrentUser() user: User,
    @Body() dto: InitializePaymentDto,
  ): Promise<{ data: FlutterwaveInitData; message: string }> {
    const data = await this.paymentsService.initializePayment(user.id, dto);
    return { data, message: 'Payment initialized' };
  }

  @Get('verify/:transactionId')
  async verify(
    @CurrentUser() user: User,
    @Param('transactionId') transactionId: string,
  ) {
    const data = await this.paymentsService.verifyPayment(transactionId, user.id);
    return { data, message: data.paid ? 'Payment verified' : 'Payment not confirmed' };
  }

  @Get('bank-details')
  getBankDetails(): { data: BankDetails; message: string } {
    return { data: this.paymentsService.getBankDetails(), message: 'OK' };
  }

  @Post('bank-transfer')
  async submitBankTransfer(
    @CurrentUser() user: User,
    @Body() dto: SubmitBankTransferDto,
  ) {
    const data = await this.paymentsService.submitBankTransfer(user.id, dto);
    return { data, message: 'Transfer submitted for verification' };
  }

  @Patch(':orderId/confirm-manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async confirmManual(@Param('orderId') orderId: string) {
    const data = await this.paymentsService.confirmManualPayment(orderId);
    return { data, message: 'Payment confirmed' };
  }

  @Patch(':orderId/reject-manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async rejectManual(@Param('orderId') orderId: string) {
    const data = await this.paymentsService.rejectManualPayment(orderId);
    return { data, message: 'Transfer rejected, order cancelled' };
  }
}

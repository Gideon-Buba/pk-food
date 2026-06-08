import { Controller, Post, Headers, RawBody, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';

interface WebhookEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: Record<string, string>;
  };
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('paystack')
  async handlePaystack(
    @Headers('x-paystack-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Body() body: WebhookEvent,
  ): Promise<{ data: null; message: string }> {
    this.paymentsService.verifyWebhookSignature(rawBody, signature);
    await this.paymentsService.handleWebhookEvent(body);
    return { data: null, message: 'OK' };
  }
}

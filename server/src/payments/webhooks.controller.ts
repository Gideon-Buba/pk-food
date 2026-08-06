import { Controller, Post, Headers, Body } from '@nestjs/common';
import { PaymentsService, WebhookEvent } from './payments.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('flutterwave')
  async handleFlutterwave(
    @Headers('verif-hash') signature: string,
    @Body() body: WebhookEvent,
  ): Promise<{ data: null; message: string }> {
    this.paymentsService.verifyWebhookSignature(signature);
    await this.paymentsService.handleWebhookEvent(body);
    return { data: null, message: 'OK' };
  }
}

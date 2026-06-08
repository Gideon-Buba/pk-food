import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

export interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: PaystackInitData;
}

interface PaystackVerifyData {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amount: number;
  paid_at: string;
  metadata: Record<string, string>;
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: PaystackVerifyData;
}

interface WebhookEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: Record<string, string>;
  };
}

@Injectable()
export class PaymentsService {
  private readonly paystackBase = 'https://api.paystack.co';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly notifications: NotificationsService,
  ) {}

  private get authHeader(): string {
    return `Bearer ${this.config.paystackSecretKey}`;
  }

  async initializePayment(
    userId: string,
    dto: InitializePaymentDto,
  ): Promise<PaystackInitData> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        user: { select: { email: true } },
        items: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.paid) throw new BadRequestException('Order already paid');

    const itemsTotal = order.items.reduce(
      (sum, i) => sum + i.unitPrice.toNumber() * i.quantity,
      0,
    );
    const totalNaira = itemsTotal + order.deliveryFee.toNumber();
    const amountKobo = Math.round(totalNaira * 100);

    const callbackUrl = `${this.config.appUrl}/order-confirmation?reference=${order.id}`;

    const response = await axios.post<PaystackInitResponse>(
      `${this.paystackBase}/transaction/initialize`,
      {
        email: order.user.email,
        amount: amountKobo,
        reference: order.id,
        callback_url: callbackUrl,
        metadata: { orderId: order.id },
      },
      { headers: { Authorization: this.authHeader } },
    );

    if (!response.data.status) {
      throw new InternalServerErrorException('Paystack initialization failed');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paystackRef: response.data.data.reference },
    });

    return response.data.data;
  }

  async verifyPayment(
    reference: string,
    userId: string,
  ): Promise<{ paid: boolean; status: string }> {
    const order = await this.prisma.order.findFirst({ where: { paystackRef: reference } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();

    const response = await axios.get<PaystackVerifyResponse>(
      `${this.paystackBase}/transaction/verify/${reference}`,
      { headers: { Authorization: this.authHeader } },
    );

    const { status: txStatus } = response.data.data;
    const paid = txStatus === 'success';

    if (paid) {
      await this.prisma.order.updateMany({
        where: { paystackRef: reference, paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
    } else if (txStatus === 'abandoned' || txStatus === 'failed') {
      const order = await this.prisma.order.findFirst({
        where: { paystackRef: reference, paid: false },
      });
      if (order) {
        await this.prisma.$transaction(async (tx) => {
          await this.ordersService.restoreStock(order.id, tx);
          await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        });
      }
    }

    return { paid, status: txStatus };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): void {
    const hash = createHmac('sha512', this.config.paystackSecretKey)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    if (event.event === 'charge.success') {
      const { reference } = event.data;
      const order = await this.prisma.order.findFirst({
        where: { paystackRef: reference },
        select: { id: true, paid: true },
      });
      if (!order || order.paid) return;
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paid: true, status: 'CONFIRMED' },
      });
      void this.notifications.notifyNewOrder(order.id).catch(() => undefined);
    }
  }
}

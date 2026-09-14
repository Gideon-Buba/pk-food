import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { SubmitBankTransferDto } from './dto/submit-bank-transfer.dto';

export interface FlutterwaveInitData {
  link: string;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  contactPhone: string;
}

interface FlutterwaveInitResponse {
  status: string;
  message: string;
  data: { link: string };
}

interface FlutterwaveVerifyData {
  status: 'successful' | 'failed' | 'cancelled' | 'pending';
  tx_ref: string;
  id: number;
  amount: number;
  currency: string;
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: FlutterwaveVerifyData;
}

export interface WebhookEvent {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
  };
}

@Injectable()
export class PaymentsService {
  private readonly flwBase = 'https://api.flutterwave.com/v3';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly notifications: NotificationsService,
  ) {}

  private get authHeader(): string {
    return `Bearer ${this.config.flutterwaveSecretKey}`;
  }

  async initializePayment(
    userId: string,
    dto: InitializePaymentDto,
  ): Promise<FlutterwaveInitData> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        user: { select: { email: true, name: true } },
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
    const totalNaira = itemsTotal + order.deliveryFee.toNumber() + order.packagingFee.toNumber();

    // Redirect URL — Flutterwave appends ?status=&tx_ref=&transaction_id= automatically
    const redirectUrl = `${this.config.appUrl}/order-confirmation`;

    const response = await axios.post<FlutterwaveInitResponse>(
      `${this.flwBase}/payments`,
      {
        tx_ref: order.id,
        amount: totalNaira,
        currency: 'NGN',
        redirect_url: redirectUrl,
        customer: {
          email: order.user.email,
          name: order.user.name ?? order.user.email,
        },
        customizations: {
          title: 'PK Food',
          description: 'Food order payment',
        },
      },
      { headers: { Authorization: this.authHeader } },
    );

    if (response.data.status !== 'success') {
      throw new InternalServerErrorException('Flutterwave initialization failed');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: order.id },
    });

    return { link: response.data.data.link };
  }

  async verifyPayment(
    transactionId: string,
    userId: string,
  ): Promise<{ paid: boolean; status: string }> {
    const response = await axios.get<FlutterwaveVerifyResponse>(
      `${this.flwBase}/transactions/${transactionId}/verify`,
      { headers: { Authorization: this.authHeader } },
    );

    const txData = response.data.data;
    if (!txData) throw new NotFoundException('Transaction not found');

    // Locate our order by the tx_ref we stored (order.id)
    const order = await this.prisma.order.findFirst({
      where: { paymentRef: txData.tx_ref },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();

    const paid = txData.status === 'successful';

    if (paid) {
      const result = await this.prisma.order.updateMany({
        where: { paymentRef: txData.tx_ref, paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
      if (result.count > 0) {
        void this.notifications.notifyNewOrder(order.id).catch(() => undefined);
      }
    } else if (txData.status === 'failed' || txData.status === 'cancelled') {
      const unpaid = await this.prisma.order.findFirst({
        where: { paymentRef: txData.tx_ref, paid: false },
      });
      if (unpaid) {
        await this.prisma.$transaction(async (tx) => {
          await this.ordersService.restoreStock(unpaid.id, tx);
          await tx.order.update({ where: { id: unpaid.id }, data: { status: 'CANCELLED' } });
        });
      }
    }

    return { paid, status: txData.status };
  }

  // ── Manual bank transfer ──────────────────────────────────────────────────

  getBankDetails(): BankDetails {
    return {
      bankName: this.config.bankName,
      accountName: this.config.bankAccountName,
      accountNumber: this.config.bankAccountNumber,
      contactPhone: this.config.paymentContactPhone,
    };
  }

  async submitBankTransfer(
    userId: string,
    dto: SubmitBankTransferDto,
  ): Promise<{ reference: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.paid) throw new BadRequestException('Order already paid');

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: 'BANK_TRANSFER',
        transferReference: dto.transferReference ?? null,
        paymentRef: order.id,
      },
    });

    void this.notifications
      .notifyPendingTransfer(order.id)
      .catch(() => undefined);

    return { reference: order.reference };
  }

  async confirmManualPayment(
    orderId: string,
  ): Promise<{ paid: boolean; status: string }> {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, paid: false },
      data: { paid: true, status: 'CONFIRMED' },
    });

    if (result.count === 0) {
      throw new NotFoundException('No unpaid order found with that id');
    }

    void this.notifications.notifyNewOrder(orderId).catch(() => undefined);

    return { paid: true, status: 'CONFIRMED' };
  }

  async rejectManualPayment(
    orderId: string,
  ): Promise<{ status: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paid) {
      throw new BadRequestException('Cannot reject a paid order');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.ordersService.restoreStock(orderId, tx);
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
    });

    return { status: 'CANCELLED' };
  }

  verifyWebhookSignature(signature: string): void {
    if (signature !== this.config.flutterwaveSecretHash) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const txRef = event.data.tx_ref;

      // Re-verify with Flutterwave API to avoid spoofed webhook bodies
      const response = await axios.get<FlutterwaveVerifyResponse>(
        `${this.flwBase}/transactions/${event.data.id}/verify`,
        { headers: { Authorization: this.authHeader } },
      );

      if (response.data.data?.status !== 'successful') return;
      if (response.data.data.tx_ref !== txRef) return;

      const order = await this.prisma.order.findFirst({
        where: { paymentRef: txRef },
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

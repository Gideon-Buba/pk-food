import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { PushService } from './push.service';
import { TelegramService } from './telegram.service';

function formatNaira(kobo: number): string {
  // Prices are stored as Decimal (naira), not kobo — convert to number and format.
  return `₦${kobo.toLocaleString('en-NG')}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Notify all ADMINs and RUNNERs about a newly placed order.
   * Fetches the full order from the DB so this method only needs the order id.
   * Never throws — all errors are caught and logged.
   */
  async notifyNewOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true } },
        items: { include: { menuItem: true } },
      },
    });

    if (!order) {
      this.logger.warn(`notifyNewOrder: order ${orderId} not found`);
      return;
    }

    const shortId = orderId.slice(-8).toUpperCase();

    const itemLines = order.items
      .map(
        (i) =>
          `${i.quantity}x ${i.menuItem.name} — ${formatNaira(Number(i.unitPrice) * i.quantity)}`,
      )
      .join('\n');

    const itemTotal = order.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );
    const deliveryFee = Number(order.deliveryFee);
    const total = formatNaira(itemTotal + deliveryFee);
    const itemCount = order.items.length;

    const pushPayload = {
      title: `New order #${shortId}`,
      body: `${order.user.name ?? order.user.email} — ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
      url: `${this.config.appUrl}/admin`,
    };

    const results = await Promise.allSettled([
      this.push
        .sendToRoles([Role.ADMIN, Role.RUNNER], pushPayload)
        .catch((err: unknown) => {
          this.logger.error('Push notification batch failed:', err);
        }),
      this.telegram.notifyNewOrder(
        orderId,
        order.user.name,
        order.user.email,
        String(order.floor),
        order.officeNumber,
        itemLines,
        formatNaira(deliveryFee),
        total,
        this.config.appUrl,
      ),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Notification channel failed:', result.reason);
      }
    }
  }
}

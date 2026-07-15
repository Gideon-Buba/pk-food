import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ItemStatus, Order, OrderStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:  [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]:  [OrderStatus.READY,     OrderStatus.CANCELLED],
  [OrderStatus.READY]:      [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
};

const orderInclude = {
  items: { include: { menuItem: { include: { vendor: true } } } },
  user: { select: { name: true, email: true, floor: true, officeNumber: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async createOrder(user: User, dto: CreateOrderDto): Promise<Order> {
    const order = await this.prisma.$transaction(async (tx) => {
      const menuItemIds = dto.items.map((i) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      });

      for (const orderItem of dto.items) {
        const item = menuItems.find((m) => m.id === orderItem.menuItemId);
        if (!item) {
          throw new NotFoundException(`Menu item ${orderItem.menuItemId} not found`);
        }
        if (item.status !== ItemStatus.AVAILABLE) {
          throw new BadRequestException(`"${item.name}" is not available`);
        }
        if (item.onlineStock < orderItem.quantity) {
          throw new BadRequestException(`Insufficient stock for "${item.name}"`);
        }
      }

      for (const orderItem of dto.items) {
        const item = menuItems.find((m) => m.id === orderItem.menuItemId)!;
        const newStock = item.onlineStock - orderItem.quantity;
        await tx.menuItem.update({
          where: { id: orderItem.menuItemId },
          data: {
            onlineStock: newStock,
            status: newStock === 0 ? ItemStatus.OUT_OF_STOCK : ItemStatus.AVAILABLE,
          },
        });
      }

      return tx.order.create({
        data: {
          userId: user.id,
          floor: dto.floor ?? user.floor ?? '',
          officeNumber: dto.officeNumber ?? user.officeNumber ?? '',
          phone: dto.phone,
          deliveryFee: this.config.deliveryFee,
          items: {
            create: dto.items.map((orderItem) => {
              const item = menuItems.find((m) => m.id === orderItem.menuItemId)!;
              return {
                menuItemId: orderItem.menuItemId,
                quantity: orderItem.quantity,
                unitPrice: item.price,
              };
            }),
          },
        },
        include: { items: { include: { menuItem: true } }, user: true },
      });
    }, { timeout: 15000 });

    // Fire-and-forget: notification errors must never fail order creation.
    void this.notifications.notifyNewOrder(order.id).catch((err: unknown) => {
      this.logger.error('New-order notification failed:', err);
    });

    return order;
  }

  async findAll(user: User): Promise<OrderWithRelations[]> {
    const where = user.role === Role.STAFF ? { userId: user.id } : undefined;

    return this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: User): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) throw new NotFoundException('Order not found');
    if (user.role === Role.STAFF && order.userId !== user.id) {
      throw new ForbiddenException();
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, role: Role): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const RUNNER_ALLOWED: OrderStatus[] = [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED];
    if (role === Role.RUNNER && !RUNNER_ALLOWED.includes(dto.status)) {
      throw new ForbiddenException('Runners can only mark orders as In Transit or Delivered');
    }

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed) {
      throw new BadRequestException(`Order is ${order.status} and cannot be updated further`);
    }
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move order from ${order.status} to ${dto.status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async getDeliveredToday(): Promise<OrderWithRelations[]> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: dayStart },
      },
      include: orderInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async restoreStock(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
      if (!menuItem) continue;
      const newStock = menuItem.onlineStock + item.quantity;
      await tx.menuItem.update({
        where: { id: item.menuItemId },
        data: {
          onlineStock: newStock,
          // Only flip to AVAILABLE if it was OUT_OF_STOCK — respect admin-set UNAVAILABLE
          status: menuItem.status === ItemStatus.OUT_OF_STOCK ? ItemStatus.AVAILABLE : menuItem.status,
        },
      });
    }
  }

  async cancelOrder(id: string, userId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.paid) throw new BadRequestException('Paid orders cannot be cancelled — contact admin');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending unpaid orders can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.restoreStock(id, tx);
      return tx.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } });
    });
  }

  async getDeliveryQueue(): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.IN_TRANSIT] },
      },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
    });
  }
}

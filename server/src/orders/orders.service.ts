import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ItemStatus, Order, OrderStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const orderInclude = {
  items: { include: { menuItem: true } },
  user: { select: { email: true, floor: true, officeNumber: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createOrder(user: User, dto: CreateOrderDto): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
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

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async getDeliveryQueue(): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.READY, OrderStatus.IN_TRANSIT] },
      },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
    });
  }
}

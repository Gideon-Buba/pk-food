import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ItemStatus, OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

// Build lightweight mock objects that match what the service code reads
function mockMenuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    name: 'Jollof Rice',
    price: { toNumber: () => 1500 },
    status: ItemStatus.AVAILABLE,
    onlineStock: 10,
    totalStock: 10,
    vendorId: 'vendor-1',
    ...overrides,
  };
}

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    paid: false,
    floor: 'F3',
    officeNumber: '301',
    phone: '08000000000',
    deliveryFee: { toNumber: () => 300 },
    paystackRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    user: { name: 'Alice', email: 'alice@nrs.gov.ng', floor: 'F3', officeNumber: '301' },
    ...overrides,
  };
}

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@nrs.gov.ng',
    role: Role.STAFF,
    floor: 'F3',
    officeNumber: '301',
    ...overrides,
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    $transaction: jest.Mock;
    order: Record<string, jest.Mock>;
    orderItem: Record<string, jest.Mock>;
    menuItem: Record<string, jest.Mock>;
  };

  const mockConfig = { deliveryFee: 300 };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      orderItem: { findMany: jest.fn() },
      menuItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    // Default: $transaction calls the callback with the same mock (tx === prisma)
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: NotificationsService, useValue: { notifyNewOrder: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createOrder ───────────────────────────────────────────────────────────

  describe('createOrder', () => {
    const dto = {
    items: [{ menuItemId: 'item-1', quantity: 2 }],
    floor: 'F3' as never,
    officeNumber: '301',
    phone: '08000000000',
  };
    const actor = mockUser();

    it('throws NotFoundException when a menu item does not exist', async () => {
      prisma.menuItem.findMany.mockResolvedValue([]);

      await expect(service.createOrder(actor as never, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when an item is not AVAILABLE', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        mockMenuItem({ status: ItemStatus.OUT_OF_STOCK }),
      ]);

      await expect(service.createOrder(actor as never, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        mockMenuItem({ onlineStock: 1 }), // only 1 in stock, ordering 2
      ]);

      await expect(
        service.createOrder(actor as never, { ...dto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('decrements stock and creates the order', async () => {
      const item = mockMenuItem({ onlineStock: 5 });
      prisma.menuItem.findMany.mockResolvedValue([item]);
      prisma.menuItem.update.mockResolvedValue(undefined);
      prisma.order.create.mockResolvedValue(mockOrder());

      await service.createOrder(actor as never, dto);

      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { onlineStock: 3, status: ItemStatus.AVAILABLE },
      });
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('sets status to OUT_OF_STOCK when last unit is taken', async () => {
      const item = mockMenuItem({ onlineStock: 2 });
      prisma.menuItem.findMany.mockResolvedValue([item]);
      prisma.menuItem.update.mockResolvedValue(undefined);
      prisma.order.create.mockResolvedValue(mockOrder());

      await service.createOrder(actor as never, dto); // ordering 2, stock is 2

      expect(prisma.menuItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ItemStatus.OUT_OF_STOCK }) }),
      );
    });
  });

  // ── updateStatus (FSM transitions) ───────────────────────────────────────

  describe('updateStatus', () => {
    it('throws NotFoundException for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('order-x', { status: OrderStatus.CONFIRMED }, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for a terminal order (DELIVERED)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.DELIVERED }));
      await expect(
        service.updateStatus('order-1', { status: OrderStatus.CONFIRMED }, Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid transition (PENDING → READY)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.PENDING }));
      await expect(
        service.updateStatus('order-1', { status: OrderStatus.READY }, Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when a RUNNER tries to set CONFIRMED', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.PENDING }));
      await expect(
        service.updateStatus('order-1', { status: OrderStatus.CONFIRMED }, Role.RUNNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows RUNNER to set IN_TRANSIT → DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.IN_TRANSIT }));
      prisma.order.update.mockResolvedValue(mockOrder({ status: OrderStatus.DELIVERED }));

      await service.updateStatus('order-1', { status: OrderStatus.DELIVERED }, Role.RUNNER);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.DELIVERED },
      });
    });

    it('allows ADMIN to advance through valid transitions', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.CONFIRMED }));
      prisma.order.update.mockResolvedValue(mockOrder({ status: OrderStatus.PREPARING }));

      await service.updateStatus('order-1', { status: OrderStatus.PREPARING }, Role.ADMIN);

      expect(prisma.order.update).toHaveBeenCalled();
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('throws NotFoundException for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancelOrder('x', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the order belongs to a different user', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for a paid order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ paid: true }));
      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order is not PENDING', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ status: OrderStatus.CONFIRMED }),
      );
      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('restores stock and cancels a PENDING unpaid order', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ items: [{ menuItemId: 'item-1', quantity: 3 }] }),
      );
      prisma.orderItem.findMany.mockResolvedValue([{ menuItemId: 'item-1', quantity: 3 }]);
      prisma.menuItem.findUnique.mockResolvedValue(mockMenuItem({ onlineStock: 2 }));
      prisma.menuItem.update.mockResolvedValue(undefined);
      prisma.order.update.mockResolvedValue(mockOrder({ status: OrderStatus.CANCELLED }));

      await service.cancelOrder('order-1', 'user-1');

      // Stock should be restored: 2 (current) + 3 (returned) = 5
      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { onlineStock: 5, status: ItemStatus.AVAILABLE },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  });

  // ── findAll / findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x', mockUser() as never)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when STAFF requests another user\'s order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(
        service.findOne('order-1', mockUser({ id: 'user-1' }) as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

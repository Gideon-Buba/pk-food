import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('axios');
import axios from 'axios';
const axiosMock = axios as jest.Mocked<typeof axios>;

const TEST_SECRET_HASH = 'my-flw-secret-hash';

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    reference: 'PK7BN2',
    userId: 'user-1',
    paid: false,
    paymentRef: 'order-1',
    paymentMethod: 'FLUTTERWAVE',
    status: 'PENDING',
    deliveryFee: { toNumber: () => 300 },
    packagingFee: { toNumber: () => 0 },
    items: [
      { unitPrice: { toNumber: () => 1500 }, quantity: 2, sides: [] },
    ],
    user: { email: 'alice@nrs.gov.ng', name: 'Alice' },
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaOrder: Record<string, jest.Mock>;
  let mockOrdersService: { restoreStock: jest.Mock };
  let mockNotifications: { notifyNewOrder: jest.Mock; notifyPendingTransfer: jest.Mock };

  const mockConfig = {
    flutterwaveSecretKey: 'flw-secret-key',
    flutterwaveSecretHash: TEST_SECRET_HASH,
    appUrl: 'http://localhost:5173',
    bankName: 'Zenith Bank',
    bankAccountName: 'NRS Canteen',
    bankAccountNumber: '1234567890',
    paymentContactPhone: '08012345678',
  };

  beforeEach(async () => {
    prismaOrder = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };

    mockOrdersService = { restoreStock: jest.fn().mockResolvedValue(undefined) };
    mockNotifications = {
      notifyNewOrder: jest.fn().mockResolvedValue(undefined),
      notifyPendingTransfer: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrisma = {
      order: prismaOrder,
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── verifyWebhookSignature ────────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    it('passes when the hash matches the configured secret', () => {
      expect(() => service.verifyWebhookSignature(TEST_SECRET_HASH)).not.toThrow();
    });

    it('throws UnauthorizedException for a wrong hash', () => {
      expect(() => service.verifyWebhookSignature('wrong-hash')).toThrow(UnauthorizedException);
    });
  });

  // ── handleWebhookEvent ────────────────────────────────────────────────────

  describe('handleWebhookEvent', () => {
    it('marks order as paid and CONFIRMED on charge.completed', async () => {
      prismaOrder.findFirst.mockResolvedValue({ id: 'order-1', paid: false });
      prismaOrder.update.mockResolvedValue(undefined);

      axiosMock.get = jest.fn().mockResolvedValue({
        data: {
          status: 'success',
          data: { status: 'successful', tx_ref: 'order-1', id: 12345, amount: 3300, currency: 'NGN' },
        },
      });

      await service.handleWebhookEvent({
        event: 'charge.completed',
        data: { id: 12345, tx_ref: 'order-1', status: 'successful', amount: 3300, currency: 'NGN' },
      });

      expect(prismaOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paid: true, status: 'CONFIRMED' },
      });
    });

    it('ignores unknown webhook events without throwing', async () => {
      await expect(
        service.handleWebhookEvent({
          event: 'transfer.completed',
          data: { id: 99, tx_ref: 'order-1', status: 'successful', amount: 0, currency: 'NGN' },
        }),
      ).resolves.toBeUndefined();

      expect(prismaOrder.update).not.toHaveBeenCalled();
    });

    it('ignores events where Flutterwave verify returns non-successful', async () => {
      axiosMock.get = jest.fn().mockResolvedValue({
        data: { status: 'success', data: { status: 'failed', tx_ref: 'order-1', id: 12345 } },
      });

      await service.handleWebhookEvent({
        event: 'charge.completed',
        data: { id: 12345, tx_ref: 'order-1', status: 'successful', amount: 3300, currency: 'NGN' },
      });

      expect(prismaOrder.update).not.toHaveBeenCalled();
    });
  });

  // ── initializePayment ─────────────────────────────────────────────────────

  describe('initializePayment', () => {
    it('throws NotFoundException when order does not exist', async () => {
      prismaOrder.findUnique.mockResolvedValue(null);
      await expect(service.initializePayment('user-1', { orderId: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when order belongs to a different user', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(service.initializePayment('user-1', { orderId: 'order-1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for an already-paid order', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder({ paid: true }));
      await expect(service.initializePayment('user-1', { orderId: 'order-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls Flutterwave and returns a checkout link', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder());
      prismaOrder.update.mockResolvedValue(undefined);

      axiosMock.post = jest.fn().mockResolvedValue({
        data: {
          status: 'success',
          message: 'Hosted Link',
          data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/abc' },
        },
      });

      const result = await service.initializePayment('user-1', { orderId: 'order-1' });

      expect(result.link).toBe('https://checkout.flutterwave.com/v3/hosted/pay/abc');
      expect(prismaOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paymentRef: 'order-1' },
      });
    });
  });

  // ── verifyPayment ─────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('throws NotFoundException when Flutterwave returns no data', async () => {
      axiosMock.get = jest.fn().mockResolvedValue({ data: { data: null } });
      await expect(service.verifyPayment('12345', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when order belongs to a different user', async () => {
      axiosMock.get = jest.fn().mockResolvedValue({
        data: { data: { status: 'successful', tx_ref: 'order-1', id: 12345, amount: 3300, currency: 'NGN' } },
      });
      prismaOrder.findFirst.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(service.verifyPayment('12345', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('marks order paid when Flutterwave reports successful', async () => {
      axiosMock.get = jest.fn().mockResolvedValue({
        data: { data: { status: 'successful', tx_ref: 'order-1', id: 12345, amount: 3300, currency: 'NGN' } },
      });
      prismaOrder.findFirst.mockResolvedValue(mockOrder());
      prismaOrder.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.verifyPayment('12345', 'user-1');

      expect(result).toEqual({ paid: true, status: 'successful' });
      expect(prismaOrder.updateMany).toHaveBeenCalledWith({
        where: { paymentRef: 'order-1', paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
    });
  });

  // ── manual bank transfer ──────────────────────────────────────────────────

  describe('getBankDetails', () => {
    it('returns the configured account details', () => {
      expect(service.getBankDetails()).toEqual({
        bankName: 'Zenith Bank',
        accountName: 'NRS Canteen',
        accountNumber: '1234567890',
        contactPhone: '08012345678',
      });
    });
  });

  describe('submitBankTransfer', () => {
    it('sets BANK_TRANSFER + note and returns the order reference', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder());
      prismaOrder.update.mockResolvedValue(undefined);

      const result = await service.submitBankTransfer('user-1', {
        orderId: 'order-1',
        transferReference: 'my narration',
      });

      expect(result).toEqual({ reference: 'PK7BN2' });
      expect(prismaOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paymentMethod: 'BANK_TRANSFER', transferReference: 'my narration', paymentRef: 'order-1' },
      });
      expect(mockNotifications.notifyPendingTransfer).toHaveBeenCalledWith('order-1');
    });

    it('rejects a paid order', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder({ paid: true }));
      await expect(
        service.submitBankTransfer('user-1', { orderId: 'order-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an order owned by another user', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(
        service.submitBankTransfer('user-1', { orderId: 'order-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('confirmManualPayment', () => {
    it('flips paid + status and fires the confirmation notification', async () => {
      prismaOrder.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirmManualPayment('order-1');

      expect(result).toEqual({ paid: true, status: 'CONFIRMED' });
      expect(prismaOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
      expect(mockNotifications.notifyNewOrder).toHaveBeenCalledWith('order-1');
    });

    it('throws when there is no matching unpaid order', async () => {
      prismaOrder.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.confirmManualPayment('order-1')).rejects.toThrow(NotFoundException);
      expect(mockNotifications.notifyNewOrder).not.toHaveBeenCalled();
    });
  });

  describe('rejectManualPayment', () => {
    it('restores stock and cancels the order', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder());
      prismaOrder.update.mockResolvedValue(undefined);

      const result = await service.rejectManualPayment('order-1');

      expect(result).toEqual({ status: 'CANCELLED' });
      expect(mockOrdersService.restoreStock).toHaveBeenCalledWith('order-1', expect.anything());
      expect(prismaOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('refuses to reject a paid order', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder({ paid: true }));
      await expect(service.rejectManualPayment('order-1')).rejects.toThrow(BadRequestException);
    });
  });
});

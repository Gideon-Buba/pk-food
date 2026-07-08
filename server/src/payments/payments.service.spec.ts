import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { OrdersService } from '../orders/orders.service';

jest.mock('axios');
import axios from 'axios';
const axiosMock = axios as jest.Mocked<typeof axios>;

const TEST_SECRET = 'paystack-secret-key';

function makeSignature(body: string): string {
  return createHmac('sha512', TEST_SECRET).update(body).digest('hex');
}

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    paid: false,
    paystackRef: 'ref-1',
    status: 'PENDING',
    deliveryFee: { toNumber: () => 300 },
    items: [
      { unitPrice: { toNumber: () => 1500 }, quantity: 2 },
    ],
    user: { email: 'alice@nrs.gov.ng' },
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaOrder: Record<string, jest.Mock>;
  let mockOrdersService: { restoreStock: jest.Mock };

  const mockConfig = {
    paystackSecretKey: TEST_SECRET,
    appUrl: 'http://localhost:5173',
  };

  beforeEach(async () => {
    prismaOrder = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };

    mockOrdersService = { restoreStock: jest.fn().mockResolvedValue(undefined) };

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
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── verifyWebhookSignature ────────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    it('passes for a valid HMAC-SHA512 signature', () => {
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref' } });
      const sig = makeSignature(body);
      expect(() => service.verifyWebhookSignature(Buffer.from(body), sig)).not.toThrow();
    });

    it('throws UnauthorizedException for an invalid signature', () => {
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref' } });
      expect(() =>
        service.verifyWebhookSignature(Buffer.from(body), 'bad-sig'),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the body has been tampered with', () => {
      const original = JSON.stringify({ event: 'charge.success', data: { reference: 'ref' } });
      const sig = makeSignature(original);
      const tampered = JSON.stringify({ event: 'charge.success', data: { reference: 'OTHER' } });
      expect(() =>
        service.verifyWebhookSignature(Buffer.from(tampered), sig),
      ).toThrow(UnauthorizedException);
    });
  });

  // ── handleWebhookEvent ────────────────────────────────────────────────────

  describe('handleWebhookEvent', () => {
    it('marks order as paid and CONFIRMED on charge.success', async () => {
      prismaOrder.updateMany.mockResolvedValue({ count: 1 });

      await service.handleWebhookEvent({
        event: 'charge.success',
        data: { reference: 'ref-1', status: 'success', amount: 360000 },
      });

      expect(prismaOrder.updateMany).toHaveBeenCalledWith({
        where: { paystackRef: 'ref-1', paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
    });

    it('ignores unknown webhook events without throwing', async () => {
      await expect(
        service.handleWebhookEvent({
          event: 'transfer.success',
          data: { reference: 'ref-1', status: 'success', amount: 0 },
        }),
      ).resolves.toBeUndefined();

      expect(prismaOrder.updateMany).not.toHaveBeenCalled();
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

    it('calls Paystack initialize and stores the reference', async () => {
      prismaOrder.findUnique.mockResolvedValue(mockOrder());
      prismaOrder.update.mockResolvedValue(undefined);

      axiosMock.post = jest.fn().mockResolvedValue({
        data: {
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/abc',
            access_code: 'abc',
            reference: 'order-1',
          },
        },
      });

      const result = await service.initializePayment('user-1', { orderId: 'order-1' });

      expect(result.authorization_url).toBe('https://checkout.paystack.com/abc');
      expect(prismaOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paystackRef: 'order-1' },
      });
    });
  });

  // ── verifyPayment ─────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('throws NotFoundException when no order matches the reference', async () => {
      prismaOrder.findFirst.mockResolvedValue(null);
      await expect(service.verifyPayment('bad-ref', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when reference belongs to a different user', async () => {
      prismaOrder.findFirst.mockResolvedValue(mockOrder({ userId: 'user-2' }));
      await expect(service.verifyPayment('ref-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('marks order paid when Paystack reports success', async () => {
      prismaOrder.findFirst.mockResolvedValue(mockOrder());
      prismaOrder.updateMany.mockResolvedValue({ count: 1 });

      axiosMock.get = jest.fn().mockResolvedValue({
        data: {
          status: true,
          data: { status: 'success', reference: 'ref-1', amount: 360000, paid_at: new Date().toISOString(), metadata: {} },
        },
      });

      const result = await service.verifyPayment('ref-1', 'user-1');

      expect(result).toEqual({ paid: true, status: 'success' });
      expect(prismaOrder.updateMany).toHaveBeenCalledWith({
        where: { paystackRef: 'ref-1', paid: false },
        data: { paid: true, status: 'CONFIRMED' },
      });
    });
  });
});

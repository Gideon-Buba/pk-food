import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) },
  })),
}));

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@nrs.gov.ng',
    password: '$2b$12$hashed',
    emailVerified: true,
    verifyToken: null,
    verifyTokenExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    name: 'Alice',
    phone: null,
    role: 'STAFF',
    floor: null,
    officeNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prismaUser: Record<string, jest.Mock>;

  const mockJwt = { sign: jest.fn().mockReturnValue('signed-jwt') };
  const mockConfig = {
    isDev: true,
    appUrl: 'http://localhost:5173',
    emailFrom: 'noreply@pkfood.ng',
    resendApiKey: 're_test_key',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '7d',
    paystackSecretKey: 'sk_test',
    paystackPublicKey: 'pk_test',
    deliveryFee: 300,
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
  };

  beforeEach(async () => {
    prismaUser = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user: prismaUser } },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('blocks non-@nrs.gov.ng emails', async () => {
      await expect(
        service.register('user@gmail.com', 'pass', 'User'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when the account is already verified', async () => {
      prismaUser.findUnique.mockResolvedValue(user({ emailVerified: true }));
      await expect(
        service.register('alice@nrs.gov.ng', 'pass', 'Alice'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new user and sends a verification email', async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      prismaUser.create.mockResolvedValue(user({ emailVerified: false }));
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      await expect(
        service.register('new@nrs.gov.ng', 'password', 'New'),
      ).resolves.toBeUndefined();

      expect(prismaUser.create).toHaveBeenCalled();
    });

    it('deletes newly-created user when verification email cannot be sent', async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      prismaUser.create.mockResolvedValue(user({ emailVerified: false }));
      prismaUser.delete.mockResolvedValue(undefined);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      // Override the Resend instance after service construction
      (service as unknown as Record<string, unknown>)['resend'] = {
        emails: { send: jest.fn().mockRejectedValue(new Error('smtp error')) },
      };

      await expect(
        service.register('new@nrs.gov.ng', 'password', 'New'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaUser.delete).toHaveBeenCalledWith({ where: { email: 'new@nrs.gov.ng' } });
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws for unknown email', async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      await expect(service.login('ghost@nrs.gov.ng', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for unverified account', async () => {
      prismaUser.findUnique.mockResolvedValue(user({ emailVerified: false }));
      await expect(service.login('alice@nrs.gov.ng', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for wrong password', async () => {
      prismaUser.findUnique.mockResolvedValue(user());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      await expect(service.login('alice@nrs.gov.ng', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns a signed JWT on valid credentials', async () => {
      prismaUser.findUnique.mockResolvedValue(user());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login('alice@nrs.gov.ng', 'correct');

      expect(result).toEqual({ token: 'signed-jwt' });
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'alice@nrs.gov.ng',
        role: 'STAFF',
      });
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('throws NotFoundException for an unknown token', async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException for an expired token', async () => {
      prismaUser.findUnique.mockResolvedValue(
        user({
          emailVerified: false,
          verifyToken: 'tok',
          verifyTokenExpiry: new Date(Date.now() - 1_000),
        }),
      );
      await expect(service.verifyEmail('tok')).rejects.toThrow(UnauthorizedException);
    });

    it('is idempotent — skips update when already verified', async () => {
      prismaUser.findUnique.mockResolvedValue(
        user({ emailVerified: true, verifyToken: 'tok', verifyTokenExpiry: new Date(Date.now() + 3_600_000) }),
      );
      await expect(service.verifyEmail('tok')).resolves.toBeUndefined();
      expect(prismaUser.update).not.toHaveBeenCalled();
    });

    it('marks emailVerified for a valid, unexpired token', async () => {
      prismaUser.findUnique.mockResolvedValue(
        user({ emailVerified: false, verifyToken: 'tok', verifyTokenExpiry: new Date(Date.now() + 3_600_000) }),
      );
      prismaUser.update.mockResolvedValue(user({ emailVerified: true }));

      await service.verifyEmail('tok');

      expect(prismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
      });
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws for an invalid reset token', async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('bad', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('throws for an expired reset token', async () => {
      prismaUser.findUnique.mockResolvedValue(
        user({ resetToken: 'tok', resetTokenExpiry: new Date(Date.now() - 1_000) }),
      );
      await expect(service.resetPassword('tok', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('hashes the new password and clears the reset token', async () => {
      prismaUser.findUnique.mockResolvedValue(
        user({ resetToken: 'tok', resetTokenExpiry: new Date(Date.now() + 3_600_000) }),
      );
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
      prismaUser.update.mockResolvedValue(user());

      await service.resetPassword('tok', 'NewPass1!');

      expect(prismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hash', resetToken: null, resetTokenExpiry: null },
      });
    });
  });

  // ── devToken ──────────────────────────────────────────────────────────────

  describe('devToken', () => {
    it('throws ForbiddenException when NODE_ENV is production', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: { user: prismaUser } },
          { provide: JwtService, useValue: mockJwt },
          { provide: ConfigService, useValue: { ...mockConfig, isDev: false } },
        ],
      }).compile();

      await expect(module.get(AuthService).devToken('alice@nrs.gov.ng')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

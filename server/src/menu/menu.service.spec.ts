import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItemStatus, AnnouncementType } from '@prisma/client';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    name: 'Jollof Rice',
    price: { toNumber: () => 1500 },
    image: null,
    vendorId: 'vendor-1',
    vendor: { id: 'vendor-1', name: 'PK Canteen' },
    totalStock: 20,
    onlineStock: 10,
    status: ItemStatus.AVAILABLE,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockVendor(overrides: Record<string, unknown> = {}) {
  return { id: 'vendor-1', name: 'PK Canteen', items: [], createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function mockAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ann-1',
    type: AnnouncementType.GENERAL,
    message: 'Kitchen closes at 2pm',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MenuService', () => {
  let service: MenuService;
  let prisma: {
    menuItem: Record<string, jest.Mock>;
    vendor: Record<string, jest.Mock>;
    announcement: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      menuItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      vendor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      announcement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MenuService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findOneItem ───────────────────────────────────────────────────────────

  describe('findOneItem', () => {
    it('throws NotFoundException when item does not exist', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(null);
      await expect(service.findOneItem('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns serialized item with price as number', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(mockItem());
      const result = await service.findOneItem('item-1');
      expect(result.price).toBe(1500);
    });
  });

  // ── createItem ────────────────────────────────────────────────────────────

  describe('createItem', () => {
    const dto = {
      name: 'Fried Rice',
      price: 1800,
      vendorId: 'vendor-1',
      totalStock: 20,
      onlineStock: 10,
    };

    it('throws NotFoundException when vendor does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.createItem(dto as never)).rejects.toThrow(NotFoundException);
    });

    it('creates and returns the new item', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor());
      prisma.menuItem.create.mockResolvedValue(mockItem({ name: 'Fried Rice' }));

      const result = await service.createItem(dto as never);
      expect(result.name).toBe('Fried Rice');
      expect(prisma.menuItem.create).toHaveBeenCalled();
    });
  });

  // ── removeItem ────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('throws NotFoundException for a missing item', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(null);
      await expect(service.removeItem('x')).rejects.toThrow(NotFoundException);
    });

    it('deletes the item when it exists', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(mockItem());
      prisma.menuItem.delete.mockResolvedValue(undefined);

      await service.removeItem('item-1');
      expect(prisma.menuItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
  });

  // ── vendor management ─────────────────────────────────────────────────────

  describe('removeVendor', () => {
    it('throws NotFoundException when vendor does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.removeVendor('x')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when vendor still has menu items', async () => {
      prisma.vendor.findUnique.mockResolvedValue(
        mockVendor({ items: [{ id: 'item-1' }] }),
      );
      await expect(service.removeVendor('vendor-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes vendor when it has no items', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor({ items: [] }));
      prisma.vendor.delete.mockResolvedValue(undefined);

      await service.removeVendor('vendor-1');
      expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 'vendor-1' } });
    });
  });

  // ── announcements ─────────────────────────────────────────────────────────

  describe('toggleAnnouncement', () => {
    it('throws NotFoundException for a missing announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.toggleAnnouncement('x')).rejects.toThrow(NotFoundException);
    });

    it('flips active:true → false', async () => {
      prisma.announcement.findUnique.mockResolvedValue(mockAnnouncement({ active: true }));
      prisma.announcement.update.mockResolvedValue(mockAnnouncement({ active: false }));

      await service.toggleAnnouncement('ann-1');

      expect(prisma.announcement.update).toHaveBeenCalledWith({
        where: { id: 'ann-1' },
        data: { active: false },
      });
    });

    it('flips active:false → true', async () => {
      prisma.announcement.findUnique.mockResolvedValue(mockAnnouncement({ active: false }));
      prisma.announcement.update.mockResolvedValue(mockAnnouncement({ active: true }));

      await service.toggleAnnouncement('ann-1');

      expect(prisma.announcement.update).toHaveBeenCalledWith({
        where: { id: 'ann-1' },
        data: { active: true },
      });
    });
  });

  describe('deleteAnnouncement', () => {
    it('throws NotFoundException for a missing announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.deleteAnnouncement('x')).rejects.toThrow(NotFoundException);
    });
  });
});

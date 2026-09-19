import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, AnnouncementType, FoodCategory, ItemStatus, MenuItem, Side, Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateSideDto } from './dto/create-side.dto';
import { UpdateSideDto } from './dto/update-side.dto';

type MenuItemWithVendor = MenuItem & { vendor: Vendor; category: FoodCategory | null };
type SerializedMenuItem = Omit<MenuItemWithVendor, 'price'> & { price: number };

function serializeItem(item: MenuItemWithVendor): SerializedMenuItem {
  const { price, ...rest } = item;
  return { ...rest, price: price.toNumber() };
}

type SerializedSide = Omit<Side, 'price'> & { price: number };

function serializeSide(side: Side): SerializedSide {
  const { price, ...rest } = side;
  return { ...rest, price: price.toNumber() };
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllItems(onlyAvailable = false): Promise<SerializedMenuItem[]> {
    const items = await this.prisma.menuItem.findMany({
      where: onlyAvailable ? { status: ItemStatus.AVAILABLE } : undefined,
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(serializeItem);
  }

  async findOneItem(id: string): Promise<SerializedMenuItem> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return serializeItem(item);
  }

  async createItem(dto: CreateMenuItemDto): Promise<SerializedMenuItem> {
    const vendorExists = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
    });
    if (!vendorExists) throw new NotFoundException('Vendor not found');

    const item = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        price: dto.price,
        image: dto.image,
        vendorId: dto.vendorId,
        totalStock: dto.totalStock,
        onlineStock: dto.onlineStock,
        status: dto.status ?? ItemStatus.AVAILABLE,
        category: dto.category ?? null,
        requiresPackaging: dto.requiresPackaging ?? false,
      },
      include: { vendor: true },
    });
    return serializeItem(item);
  }

  async updateItem(
    id: string,
    dto: UpdateMenuItemDto,
  ): Promise<SerializedMenuItem> {
    await this.findOneItem(id);

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
        ...(dto.totalStock !== undefined && { totalStock: dto.totalStock }),
        ...(dto.onlineStock !== undefined && { onlineStock: dto.onlineStock }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.requiresPackaging !== undefined && { requiresPackaging: dto.requiresPackaging }),
      },
      include: { vendor: true },
    });
    return serializeItem(item);
  }

  async removeItem(id: string): Promise<void> {
    await this.findOneItem(id);
    await this.prisma.menuItem.delete({ where: { id } });
  }

  async findAllVendors(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({ orderBy: { name: 'asc' } });
  }

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.create({ data: { name: dto.name } });
  }

  async updateVendor(id: string, name: string): Promise<Vendor> {
    const existing = await this.prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.update({ where: { id }, data: { name } });
  }

  async removeVendor(id: string): Promise<void> {
    const existing = await this.prisma.vendor.findUnique({ where: { id }, include: { items: { take: 1 } } });
    if (!existing) throw new NotFoundException('Vendor not found');
    if (existing.items.length > 0) {
      throw new BadRequestException('Remove all menu items from this vendor before deleting it');
    }
    await this.prisma.vendor.delete({ where: { id } });
  }

  async findActiveAnnouncements(): Promise<Announcement[]> {
    return this.prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAnnouncements(): Promise<Announcement[]> {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAnnouncement(dto: CreateAnnouncementDto): Promise<Announcement> {
    return this.prisma.announcement.create({
      data: { type: dto.type as AnnouncementType, message: dto.message },
    });
  }

  async toggleAnnouncement(id: string): Promise<Announcement> {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { id },
      data: { active: !existing.active },
    });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
  }

  async findAllSides(onlyAvailable = false): Promise<SerializedSide[]> {
    const sides = await this.prisma.side.findMany({
      where: onlyAvailable ? { status: ItemStatus.AVAILABLE } : undefined,
      orderBy: { name: 'asc' },
    });
    return sides.map(serializeSide);
  }

  async findOneSide(id: string): Promise<SerializedSide> {
    const side = await this.prisma.side.findUnique({ where: { id } });
    if (!side) throw new NotFoundException('Side not found');
    return serializeSide(side);
  }

  async createSide(dto: CreateSideDto): Promise<SerializedSide> {
    const vendorExists = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendorExists) throw new NotFoundException('Vendor not found');

    const side = await this.prisma.side.create({
      data: {
        name: dto.name,
        price: dto.price ?? 0,
        vendorId: dto.vendorId,
      },
    });
    return serializeSide(side);
  }

  async updateSide(id: string, dto: UpdateSideDto): Promise<SerializedSide> {
    await this.findOneSide(id);

    const side = await this.prisma.side.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
    return serializeSide(side);
  }

  // Hard delete only when the side was never actually ordered — otherwise
  // retire it via status so past OrderItemSide rows keep a valid reference.
  async removeSide(id: string): Promise<void> {
    await this.findOneSide(id);
    const usedInOrders = await this.prisma.orderItemSide.findFirst({ where: { sideId: id } });
    if (usedInOrders) {
      throw new BadRequestException(
        'This side has already been ordered — set it to UNAVAILABLE instead of deleting it',
      );
    }
    await this.prisma.side.delete({ where: { id } });
  }

  async findSidesForItem(menuItemId: string): Promise<SerializedSide[]> {
    await this.findOneItem(menuItemId);
    const links = await this.prisma.menuItemSide.findMany({
      where: { menuItemId },
      include: { side: true },
      orderBy: { side: { name: 'asc' } },
    });
    return links.map((link) => serializeSide(link.side));
  }

  // Replaces the full set of sides offered by a menu item with `sideIds`.
  async setSidesForItem(menuItemId: string, sideIds: string[]): Promise<SerializedSide[]> {
    await this.findOneItem(menuItemId);

    if (sideIds.length > 0) {
      const existingSides = await this.prisma.side.findMany({ where: { id: { in: sideIds } } });
      if (existingSides.length !== new Set(sideIds).size) {
        throw new BadRequestException('One or more sides do not exist');
      }
    }

    await this.prisma.$transaction([
      this.prisma.menuItemSide.deleteMany({ where: { menuItemId } }),
      this.prisma.menuItemSide.createMany({
        data: sideIds.map((sideId) => ({ menuItemId, sideId })),
      }),
    ]);

    return this.findSidesForItem(menuItemId);
  }
}

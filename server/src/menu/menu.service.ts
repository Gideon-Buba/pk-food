import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, AnnouncementType, FoodCategory, ItemStatus, MenuItem, Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

type MenuItemWithVendor = MenuItem & { vendor: Vendor; category: FoodCategory | null };
type SerializedMenuItem = Omit<MenuItemWithVendor, 'price'> & { price: number };

function serializeItem(item: MenuItemWithVendor): SerializedMenuItem {
  const { price, ...rest } = item;
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
}

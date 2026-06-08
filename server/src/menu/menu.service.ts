import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemStatus, MenuItem, Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';

type MenuItemWithVendor = MenuItem & { vendor: Vendor };
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

  async findActiveAnnouncements() {
    return this.prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

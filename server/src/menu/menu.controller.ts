import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { MenuService } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('items')
  async findAllItems(@Query('all') all?: string) {
    const onlyAvailable = all !== 'true';
    const data = await this.menuService.findAllItems(onlyAvailable);
    return { data, message: 'OK' };
  }

  @Get('items/:id')
  async findOneItem(@Param('id') id: string) {
    const data = await this.menuService.findOneItem(id);
    return { data, message: 'OK' };
  }

  @Post('items')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createItem(@Body() dto: CreateMenuItemDto) {
    const data = await this.menuService.createItem(dto);
    return { data, message: 'Menu item created' };
  }

  @Patch('items/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    const data = await this.menuService.updateItem(id, dto);
    return { data, message: 'Menu item updated' };
  }

  @Delete('items/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async removeItem(@Param('id') id: string) {
    await this.menuService.removeItem(id);
    return { data: null, message: 'Menu item deleted' };
  }

  @Get('vendors')
  async findAllVendors() {
    const data = await this.menuService.findAllVendors();
    return { data, message: 'OK' };
  }

  @Post('vendors')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createVendor(@Body() dto: CreateVendorDto) {
    const data = await this.menuService.createVendor(dto);
    return { data, message: 'Vendor created' };
  }

  @Get('announcements')
  async findAnnouncements() {
    const data = await this.menuService.findActiveAnnouncements();
    return { data, message: 'OK' };
  }
}

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
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateSideDto } from './dto/create-side.dto';
import { UpdateSideDto } from './dto/update-side.dto';
import { SetMenuItemSidesDto } from './dto/set-menu-item-sides.dto';
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

  @Get('items/:id/sides')
  async findSidesForItem(@Param('id') id: string) {
    const data = await this.menuService.findSidesForItem(id);
    return { data, message: 'OK' };
  }

  @Patch('items/:id/sides')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setSidesForItem(@Param('id') id: string, @Body() dto: SetMenuItemSidesDto) {
    const data = await this.menuService.setSidesForItem(id, dto.sideIds);
    return { data, message: 'Sides updated' };
  }

  @Get('sides')
  async findAllSides(@Query('all') all?: string) {
    const onlyAvailable = all !== 'true';
    const data = await this.menuService.findAllSides(onlyAvailable);
    return { data, message: 'OK' };
  }

  @Post('sides')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createSide(@Body() dto: CreateSideDto) {
    const data = await this.menuService.createSide(dto);
    return { data, message: 'Side created' };
  }

  @Patch('sides/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateSide(@Param('id') id: string, @Body() dto: UpdateSideDto) {
    const data = await this.menuService.updateSide(id, dto);
    return { data, message: 'Side updated' };
  }

  @Delete('sides/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async removeSide(@Param('id') id: string) {
    await this.menuService.removeSide(id);
    return { data: null, message: 'Side deleted' };
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

  @Patch('vendors/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateVendor(@Param('id') id: string, @Body() body: { name: string }) {
    const data = await this.menuService.updateVendor(id, body.name);
    return { data, message: 'Vendor updated' };
  }

  @Delete('vendors/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async removeVendor(@Param('id') id: string) {
    await this.menuService.removeVendor(id);
    return { data: null, message: 'Vendor deleted' };
  }

  @Get('announcements')
  async findAnnouncements() {
    const data = await this.menuService.findActiveAnnouncements();
    return { data, message: 'OK' };
  }

  @Get('announcements/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAllAnnouncements() {
    const data = await this.menuService.findAllAnnouncements();
    return { data, message: 'OK' };
  }

  @Post('announcements')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    const data = await this.menuService.createAnnouncement(dto);
    return { data, message: 'Announcement created' };
  }

  @Patch('announcements/:id/toggle')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async toggleAnnouncement(@Param('id') id: string) {
    const data = await this.menuService.toggleAnnouncement(id);
    return { data, message: 'Announcement updated' };
  }

  @Delete('announcements/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async deleteAnnouncement(@Param('id') id: string) {
    await this.menuService.deleteAnnouncement(id);
    return { data: null, message: 'Announcement deleted' };
  }
}

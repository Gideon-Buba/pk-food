import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    const data = await this.ordersService.createOrder(user, dto);
    return { data, message: 'Order placed successfully' };
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    const data = await this.ordersService.findAll(user);
    return { data, message: 'OK' };
  }

  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles(Role.RUNNER, Role.ADMIN)
  async getQueue() {
    const data = await this.ordersService.getDeliveryQueue();
    return { data, message: 'OK' };
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles(Role.RUNNER, Role.ADMIN)
  async getDeliveredToday() {
    const data = await this.ordersService.getDeliveredToday();
    return { data, message: 'OK' };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.ordersService.findOne(id, user);
    return { data, message: 'OK' };
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.RUNNER)
  async updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const data = await this.ordersService.updateStatus(id, dto, user.role);
    return { data, message: 'Order status updated' };
  }

  @Delete(':id')
  async cancelOrder(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.ordersService.cancelOrder(id, user.id);
    return { data, message: 'Order cancelled' };
  }
}

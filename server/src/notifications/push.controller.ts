import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SubscribeDto, UnsubscribeDto } from './dto/subscribe.dto';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  getPublicKey(): { data: { publicKey: string }; message: string } {
    return { data: { publicKey: this.push.getPublicKey() }, message: 'OK' };
  }

  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: User,
    @Body() dto: SubscribeDto,
  ): Promise<{ data: null; message: string }> {
    await this.push.subscribe(user.id, dto.endpoint, dto.p256dh, dto.auth);
    return { data: null, message: 'Subscribed' };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Body() dto: UnsubscribeDto,
  ): Promise<{ data: null; message: string }> {
    await this.push.unsubscribe(dto.endpoint);
    return { data: null, message: 'Unsubscribed' };
  }
}

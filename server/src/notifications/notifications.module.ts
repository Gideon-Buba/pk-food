import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

@Module({
  controllers: [PushController, TelegramController],
  providers: [NotificationsService, PushService, TelegramService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

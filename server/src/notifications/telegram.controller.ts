import {
  Body,
  Controller,
  Delete,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '../config/config.service';
import { TelegramService, TelegramUpdate, GenerateLinkResult } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /** Authenticated: generate a short-lived linking token and return the bot deep-link. */
  @Post('generate-link')
  @UseGuards(JwtAuthGuard)
  generateLink(
    @CurrentUser() user: User,
  ): { data: GenerateLinkResult; message: string } {
    const result = this.telegram.generateLinkToken(user.id);
    return { data: result, message: 'OK' };
  }

  /** Authenticated: unlink the caller's Telegram account. */
  @Delete('link')
  @UseGuards(JwtAuthGuard)
  async unlink(
    @CurrentUser() user: User,
  ): Promise<{ data: null; message: string }> {
    await this.telegram.unlinkUser(user.id);
    return { data: null, message: 'Telegram account unlinked' };
  }

  /**
   * Telegram bot webhook — no JWT, called by Telegram's servers.
   * Optionally verified via X-Telegram-Bot-Api-Secret-Token.
   * Register with: POST https://api.telegram.org/bot<TOKEN>/setWebhook
   *   ?url=https://yourdomain/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() body: TelegramUpdate,
  ): Promise<{ data: null; message: string }> {
    const expectedSecret = this.config.telegramWebhookSecret;
    this.logger.log(`Webhook received — secret header: "${secret ?? '(none)'}", expected: "${expectedSecret}"`);
    if (expectedSecret && secret !== expectedSecret) {
      this.logger.warn('Webhook rejected: secret mismatch');
      throw new UnauthorizedException('Invalid webhook secret');
    }
    await this.telegram.handleUpdate(body);
    return { data: null, message: 'OK' };
  }
}

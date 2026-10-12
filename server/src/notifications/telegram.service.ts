import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Role } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string };
  chat: { id: number };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiBody {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
  disable_web_page_preview?: boolean;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

export interface GenerateLinkResult {
  token: string;
  botUrl: string | null;
  instructions: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  // In-memory map of short-lived link tokens → userId.
  // Fine for a single-process deployment; survives restarts gracefully
  // (users just generate a new token).
  private readonly linkTokens = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get apiBase(): string {
    return `https://api.telegram.org/bot${this.config.telegramBotToken}`;
  }

  generateLinkToken(userId: string): GenerateLinkResult {
    const token = randomBytes(16).toString('hex');
    this.linkTokens.set(token, userId);
    // Expire the token after 10 minutes regardless of use.
    setTimeout(() => this.linkTokens.delete(token), 10 * 60 * 1000);

    const botName = this.config.telegramBotName;
    const botUrl = botName ? `https://t.me/${botName}?start=${token}` : null;
    const instructions = botName
      ? `Open the link above in Telegram, then tap Start.`
      : `Message the bot with: /start ${token}`;

    return { token, botUrl, instructions };
  }

  async unlinkUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null },
    });
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat.id;
    if (!text || chatId === undefined) return;

    // Only handle /start <token> messages.
    const match = /^\/start\s+([0-9a-f]{32})$/i.exec(text);
    if (!match || !match[1]) return;

    const token = match[1];
    const userId = this.linkTokens.get(token);

    if (!userId) {
      await this.sendMessage(
        String(chatId),
        'This link has expired or already been used. Please generate a new one from the PK Food app.',
      );
      return;
    }

    this.linkTokens.delete(token);

    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: String(chatId) },
    });

    await this.sendMessage(
      String(chatId),
      'Your Telegram account is now linked to PK Food. You will receive new-order notifications here.',
    );
  }

  async notifyNewOrder(
    orderId: string,
    requesterName: string | null,
    requesterEmail: string,
    requesterPhone: string | null,
    floor: string,
    officeNumber: string,
    itemLines: string,
    total: string,
    appUrl: string,
  ): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.RUNNER] },
        telegramChatId: { not: null },
      },
      select: { telegramChatId: true },
    });

    const chatIds = recipients
      .map((u) => u.telegramChatId)
      .filter((id): id is string => id !== null);

    if (chatIds.length === 0) return;

    const message = this.buildOrderMessage(
      orderId,
      requesterName,
      requesterEmail,
      requesterPhone,
      floor,
      officeNumber,
      itemLines,
      total,
      appUrl,
    );

    await Promise.allSettled(chatIds.map((id) => this.sendMessage(id, message)));
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await axios.post<TelegramApiResponse>(
        `${this.apiBase}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        } satisfies TelegramApiBody,
      );
    } catch (err) {
      // Log but never throw — one bad chat ID must not block other sends.
      this.logger.warn(`Telegram sendMessage failed for chat ${chatId}:`, err);
    }
  }

  private buildOrderMessage(
    orderId: string,
    requesterName: string | null,
    requesterEmail: string,
    requesterPhone: string | null,
    floor: string,
    officeNumber: string,
    itemLines: string,
    total: string,
    appUrl: string,
  ): string {
    const shortId = orderId.slice(-8).toUpperCase();
    const displayName = requesterName ?? requesterEmail;
    const contactLine = requesterPhone
      ? `${displayName} — ${requesterPhone}`
      : displayName;
    return [
      `<b>New Order #${shortId}</b>`,
      `${contactLine}`,
      `Floor ${floor}, Room ${officeNumber}`,
      '',
      itemLines,
      '',
      `<b>Total: ${total}</b>`,
      `<a href="${appUrl}/admin">View in admin panel</a>`,
    ].join('\n');
  }
}

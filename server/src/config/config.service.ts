import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private require(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  }

  private optional(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }

  get isDev(): boolean {
    return process.env['NODE_ENV'] !== 'production';
  }

  get databaseUrl(): string {
    return this.require('DATABASE_URL');
  }

  get jwtSecret(): string {
    return this.require('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.optional('JWT_EXPIRES_IN', '7d');
  }

  get serverPort(): number {
    return parseInt(this.optional('SERVER_PORT', '3000'), 10);
  }

  get appUrl(): string {
    return this.optional('APP_URL', 'http://localhost:5173');
  }

  get resendApiKey(): string {
    return this.require('RESEND_API_KEY');
  }

  get emailFrom(): string {
    return this.optional('EMAIL_FROM', 'PK Food <noreply@pkfood.ng>');
  }

  get paystackSecretKey(): string {
    return this.require('PAYSTACK_SECRET_KEY');
  }

  get paystackPublicKey(): string {
    return this.require('PAYSTACK_PUBLIC_KEY');
  }

  get deliveryFee(): number {
    return parseInt(this.optional('DELIVERY_FEE', '300'), 10);
  }

  get cloudinaryCloudName(): string {
    return this.optional('CLOUDINARY_CLOUD_NAME', '');
  }

  get cloudinaryApiKey(): string {
    return this.optional('CLOUDINARY_API_KEY', '');
  }

  get cloudinaryApiSecret(): string {
    return this.optional('CLOUDINARY_API_SECRET', '');
  }

  // Web Push (VAPID) — generate keys with: npx web-push generate-vapid-keys
  get vapidPublicKey(): string  { return this.require('VAPID_PUBLIC_KEY'); }
  get vapidPrivateKey(): string { return this.require('VAPID_PRIVATE_KEY'); }
  get vapidSubject(): string    { return this.optional('VAPID_SUBJECT', 'mailto:admin@pkfood.ng'); }

  // Telegram Bot
  get telegramBotToken(): string      { return this.require('TELEGRAM_BOT_TOKEN'); }
  get telegramBotName(): string       { return this.optional('TELEGRAM_BOT_NAME', ''); }
  get telegramWebhookSecret(): string { return this.optional('TELEGRAM_WEBHOOK_SECRET', ''); }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Duck-type guard: web-push throws an error with statusCode on HTTP failures.
function isExpiredPushError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as Record<string, unknown>)['statusCode'];
  return code === 404 || code === 410;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey,
    );
  }

  getPublicKey(): string {
    return this.config.vapidPublicKey;
  }

  async subscribe(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth },
      // Re-associate with the current user if the endpoint already exists
      // (e.g. different user logged in on the same device).
      update: { userId, p256dh, auth },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    // deleteMany instead of delete so it silently succeeds if not found.
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async sendToRoles(roles: Role[], payload: PushPayload): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { user: { role: { in: roles } } },
    });

    if (subscriptions.length === 0) return;

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendOne(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn('Push send failure (non-expiry):', result.reason);
      }
    }
  }

  private async sendOne(
    id: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        JSON.stringify(payload),
      );
    } catch (err) {
      if (isExpiredPushError(err)) {
        // Subscription has expired or been revoked — prune it so we don't retry.
        await this.prisma.pushSubscription.deleteMany({ where: { id } });
        this.logger.log(`Pruned expired push subscription ${id}`);
        return;
      }
      throw err;
    }
  }
}

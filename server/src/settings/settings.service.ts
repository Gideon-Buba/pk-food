import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { isWithinStoreHours } from './store-hours.util';

const SETTINGS_ID = 'singleton';

export interface AppSettings {
  packagingFee: number;
  openTime: string;
  closeTime: string;
  discountPercent: number;
  isOpen: boolean;
}

interface SettingsRow {
  packagingFee: number;
  openTime: string;
  closeTime: string;
  discountPercent: number;
}

// Outside production the store is always open, so local dev isn't blocked by real-world hours.
function serialize(row: SettingsRow, ignoreHours: boolean): AppSettings {
  return {
    packagingFee: row.packagingFee,
    openTime: row.openTime,
    closeTime: row.closeTime,
    discountPercent: row.discountPercent,
    isOpen: ignoreHours || isWithinStoreHours(row.openTime, row.closeTime),
  };
}

export interface UpdateSettingsInput {
  packagingFee?: number;
  openTime?: string;
  closeTime?: string;
  discountPercent?: number;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(): Promise<AppSettings> {
    const settings = await this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, packagingFee: this.config.packagingFee },
    });
    return serialize(settings, this.config.isDev);
  }

  async isCurrentlyOpen(): Promise<boolean> {
    const { isOpen } = await this.get();
    return isOpen;
  }

  async update(input: UpdateSettingsInput): Promise<AppSettings> {
    const current = await this.prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
    const settings = await this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        ...(input.packagingFee !== undefined && { packagingFee: input.packagingFee }),
        ...(input.openTime !== undefined && { openTime: input.openTime }),
        ...(input.closeTime !== undefined && { closeTime: input.closeTime }),
        ...(input.discountPercent !== undefined && { discountPercent: input.discountPercent }),
      },
      create: {
        id: SETTINGS_ID,
        packagingFee: input.packagingFee ?? current?.packagingFee ?? this.config.packagingFee,
        openTime: input.openTime ?? current?.openTime ?? '08:00',
        closeTime: input.closeTime ?? current?.closeTime ?? '20:00',
        discountPercent: input.discountPercent ?? current?.discountPercent ?? 0,
      },
    });
    return serialize(settings, this.config.isDev);
  }
}

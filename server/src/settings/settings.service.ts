import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { isWithinStoreHours } from './store-hours.util';

const SETTINGS_ID = 'singleton';

export interface AppSettings {
  packagingFee: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

interface SettingsRow {
  packagingFee: number;
  openTime: string;
  closeTime: string;
}

function serialize(row: SettingsRow): AppSettings {
  return {
    packagingFee: row.packagingFee,
    openTime: row.openTime,
    closeTime: row.closeTime,
    isOpen: isWithinStoreHours(row.openTime, row.closeTime),
  };
}

export interface UpdateSettingsInput {
  packagingFee?: number;
  openTime?: string;
  closeTime?: string;
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
    return serialize(settings);
  }

  async getPackagingFee(): Promise<number> {
    const { packagingFee } = await this.get();
    return packagingFee;
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
      },
      create: {
        id: SETTINGS_ID,
        packagingFee: input.packagingFee ?? current?.packagingFee ?? this.config.packagingFee,
        openTime: input.openTime ?? current?.openTime ?? '08:00',
        closeTime: input.closeTime ?? current?.closeTime ?? '20:00',
      },
    });
    return serialize(settings);
  }
}

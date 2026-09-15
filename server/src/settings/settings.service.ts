import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

const SETTINGS_ID = 'singleton';

export interface AppSettings {
  packagingFee: number;
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
    return { packagingFee: settings.packagingFee };
  }

  async getPackagingFee(): Promise<number> {
    const { packagingFee } = await this.get();
    return packagingFee;
  }

  async updatePackagingFee(packagingFee: number): Promise<AppSettings> {
    const settings = await this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: { packagingFee },
      create: { id: SETTINGS_ID, packagingFee },
    });
    return { packagingFee: settings.packagingFee };
  }
}

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get() {
    const data = await this.settingsService.get();
    return { data, message: 'OK' };
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Body() dto: UpdateSettingsDto) {
    const data = await this.settingsService.updatePackagingFee(dto.packagingFee);
    return { data, message: 'Settings updated' };
  }
}

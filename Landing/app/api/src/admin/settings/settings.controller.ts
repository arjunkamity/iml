import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SettingsService } from '../../settings/settings.service';
import { UpdateSiteSettingDto } from '../../settings/settings.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('settings')
  get() {
    return this.service.get();
  }

  @Patch('settings')
  update(@Body() dto: UpdateSiteSettingDto) {
    return this.service.update(dto);
  }
}

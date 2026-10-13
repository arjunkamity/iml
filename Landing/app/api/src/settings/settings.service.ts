import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteSettingDto } from './settings.dto';

const SETTINGS_ID = 1;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Single settings row — created with defaults on first read. */
  async get() {
    const existing = await this.prisma.siteSetting.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) return existing;
    return this.prisma.siteSetting.create({ data: { id: SETTINGS_ID } });
  }

  async update(dto: UpdateSiteSettingDto) {
    await this.get(); // ensure the row exists before updating
    // An empty string means "clear this field" rather than "set it to blank".
    const data = Object.fromEntries(
      Object.entries(dto).map(([k, v]) => {
        if (v === '') return [k, null];
        // registrationDeadline arrives as a datetime-local string (e.g.
        // "2026-12-31T23:59") — Prisma's DateTime column needs a real Date.
        if (k === 'registrationDeadline' && typeof v === 'string') return [k, new Date(v)];
        return [k, v];
      }),
    );
    return this.prisma.siteSetting.update({
      where: { id: SETTINGS_ID },
      data,
    });
  }
}

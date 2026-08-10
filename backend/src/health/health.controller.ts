import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { Public } from '../auth/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    const row = await this.db.queryOne<{ Roles: number }>(
      'SELECT COUNT(*) AS Roles FROM dbo.Roles;',
    );
    return { status: 'ok', db: 'connected', roles: row?.Roles ?? 0 };
  }
}

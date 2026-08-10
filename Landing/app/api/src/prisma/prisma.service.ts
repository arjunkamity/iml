import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.warn(
        `Database not reachable yet (${(err as Error)?.message}). ` +
          'API continues to boot; set DATABASE_URL and start Postgres to enable queries.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

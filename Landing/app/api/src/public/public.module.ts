import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PaymentsModule, SettingsModule, MessagingModule, AuthModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}

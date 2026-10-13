import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CertificateIssuanceService } from './certificate-issuance.service';
import { CertificateQueueService } from './certificate-queue.service';

@Module({
  imports: [SettingsModule, MessagingModule],
  providers: [CertificateIssuanceService, CertificateQueueService],
  exports: [CertificateIssuanceService, CertificateQueueService],
})
export class CertificatesModule {}

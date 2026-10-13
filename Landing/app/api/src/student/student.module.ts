import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PaymentsModule } from '../payments/payments.module';
import { MessagingModule } from '../messaging/messaging.module';
import { StorageModule } from '../storage/storage.module';
import { SettingsModule } from '../settings/settings.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [PaymentsModule, MessagingModule, StorageModule, SettingsModule, CertificatesModule],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PublicModule } from './public/public.module';
import { StudentModule } from './student/student.module';
import { CertificatesModule } from './certificates/certificates.module';
import { SchoolModule } from './school/school.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { ScorecardDeliveryModule } from './scorecard-delivery/scorecard-delivery.module';
import { PanelModule } from './panel/panel.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminModule,
    PublicModule,
    StudentModule,
    CertificatesModule,
    SchoolModule,
    AssessmentsModule,
    ScorecardDeliveryModule,
    PanelModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

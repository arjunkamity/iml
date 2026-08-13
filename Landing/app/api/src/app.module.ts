import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PublicModule } from './public/public.module';
import { StudentModule } from './student/student.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminModule,
    PublicModule,
    StudentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

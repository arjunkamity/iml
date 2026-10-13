import { Module } from '@nestjs/common';
import { MessagingModule } from '../../messaging/messaging.module';
import { BroadcastController } from './broadcasts.controller';
import { BroadcastService } from './broadcasts.service';
import { BroadcastQueueService } from './broadcast-queue.service';

@Module({
  imports: [MessagingModule],
  controllers: [BroadcastController],
  providers: [BroadcastService, BroadcastQueueService],
})
export class BroadcastsModule {}

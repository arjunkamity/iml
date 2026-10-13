import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { StudentAssessmentsController } from './assessments.controller';

@Module({
  controllers: [StudentAssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}

import { Module } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { AttemptsService } from './attempts.service';
import { QuizzesController } from './quizzes.controller';
import { QuestionsController } from './questions.controller';
import { AttemptsController } from './attempts.controller';

@Module({
  providers: [QuizzesService, AttemptsService],
  controllers: [QuizzesController, QuestionsController, AttemptsController],
  exports: [QuizzesService, AttemptsService],
})
export class QuizzesModule {}

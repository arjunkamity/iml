import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { AttemptsService } from './attempts.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AttachQuestionsDto } from './dto/quiz-actions.dto';
import { CurrentUser, Roles } from '../auth/decorators';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly attempts: AttemptsService,
  ) {}

  // ---- Admin ----
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateQuizDto) {
    return this.quizzes.createQuiz(dto);
  }

  @Roles('ADMIN')
  @Get()
  list() {
    return this.quizzes.listQuizzes();
  }

  @Roles('ADMIN')
  @Post(':id/publish')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.quizzes.publishQuiz(id);
  }

  @Roles('ADMIN')
  @Post(':id/questions')
  attach(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AttachQuestionsDto,
  ) {
    return this.quizzes.attachQuestions(id, dto.questionIds);
  }

  // ---- Student ----
  @Roles('STUDENT')
  @Get('available')
  available(@CurrentUser('sub', ParseIntPipe) userId: number) {
    return this.quizzes.listAvailableForStudent(userId);
  }

  @Roles('STUDENT')
  @Post(':id/start')
  start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.attempts.startOrResume(userId, id);
  }
}

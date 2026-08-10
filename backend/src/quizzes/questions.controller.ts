import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { Roles } from '../auth/decorators';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateQuestionDto) {
    return this.quizzes.createQuestion(dto);
  }

  @Roles('ADMIN')
  @Get()
  list() {
    return this.quizzes.listQuestions();
  }
}

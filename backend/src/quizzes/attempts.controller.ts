import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { SaveAnswerDto } from './dto/quiz-actions.dto';
import { CurrentUser, Roles } from '../auth/decorators';

@ApiTags('Attempts')
@Controller('attempts')
@Roles('STUDENT')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.attempts.getState(id, userId);
  }

  @Post(':id/answer')
  answer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveAnswerDto,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.attempts.saveAnswer(userId, id, dto.questionId, dto.optionId);
  }

  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.attempts.submit(userId, id);
  }
}

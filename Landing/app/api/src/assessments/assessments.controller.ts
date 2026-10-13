import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { AssessmentsService } from './assessments.service';

class AnswerDto {
  @IsInt()
  questionId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  option!: string;
}

class SubmitAssessmentDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

// Student side only (Phase 1). The student id always comes from the JWT,
// never the request body, so one student can never read or write another's.
@Controller('student/assessments')
@UseGuards(JwtAuthGuard, StudentGuard)
export class StudentAssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  list(@Req() req: { user: { sub: number } }) {
    return this.assessments.list(Number(req.user.sub));
  }

  @Get(':slug')
  get(@Req() req: { user: { sub: number } }, @Param('slug') slug: string) {
    return this.assessments.get(Number(req.user.sub), slug);
  }

  @Get(':slug/result')
  result(@Req() req: { user: { sub: number } }, @Param('slug') slug: string) {
    return this.assessments.latestResult(Number(req.user.sub), slug);
  }

  @Post(':slug/submit')
  submit(@Req() req: { user: { sub: number } }, @Param('slug') slug: string, @Body() dto: SubmitAssessmentDto) {
    return this.assessments.submit(Number(req.user.sub), slug, dto.answers);
  }
}

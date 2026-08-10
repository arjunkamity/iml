import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicRegisterDto } from './public.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: PublicRegisterDto) {
    return this.service.register(dto);
  }

  @Get('competitions')
  competitions() {
    return this.service.competitions();
  }

  @Get('leaderboard')
  leaderboard(@Query() q: { comp?: string }) {
    return this.service.leaderboard(q.comp);
  }
}

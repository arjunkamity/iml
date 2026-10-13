import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BroadcastService } from './broadcasts.service';
import { CreateBroadcastDto, PatchBroadcastDto } from './broadcasts.dto';

@Controller('broadcasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BroadcastController {
  constructor(private readonly service: BroadcastService) {}

  @Get('audience-preview')
  previewAudience(@Query('audience') audience: string, @Query('customEmails') customEmails?: string) {
    return this.service.previewAudience(audience || 'schools', customEmails);
  }

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list({ page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Post()
  create(@Body() dto: CreateBroadcastDto) {
    return this.service.create(dto);
  }

  @Get(':code')
  get(@Param('code') code: string) {
    return this.service.get(code);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: PatchBroadcastDto) {
    return this.service.update(code, dto);
  }

  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.service.remove(code);
  }

  @Post(':code/test-send')
  testSend(@Param('code') code: string, @Body('email') email: string) {
    return this.service.testSend(code, email);
  }

  @Post(':code/send')
  send(@Param('code') code: string) {
    return this.service.send(code);
  }
}

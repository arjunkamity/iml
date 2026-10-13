import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminMessagingService } from './messaging.service';
import { UpdateMessageTemplateDto, TestSendDto } from './messaging.dto';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminMessagingController {
  constructor(private readonly service: AdminMessagingService) {}

  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Get('templates/:key')
  getTemplate(@Param('key') key: string) {
    return this.service.getTemplate(key);
  }

  @Patch('templates/:key')
  updateTemplate(@Param('key') key: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.service.updateTemplate(key, dto);
  }

  @Post('templates/:key/test')
  testSend(@Param('key') key: string, @Body() dto: TestSendDto) {
    return this.service.testSend(key, dto);
  }

  @Get('logs')
  listLogs(@Query('templateKey') templateKey?: string, @Query('take') take?: string) {
    return this.service.listLogs(templateKey, take ? Number(take) : undefined);
  }
}

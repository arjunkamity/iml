import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { FaqService } from './faqs.service';
import { CreateFaqDto, PatchFaqDto } from './faqs.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FaqController {
  constructor(private readonly service: FaqService) {}

  @Get('faqs')
  list(@Query() q: ListQueryDto) {
    return this.service.listFaqs(q);
  }

  @Get('faqs/:code')
  get(@Param('code') code: string) {
    return this.service.getFaq(code);
  }

  @Post('faqs')
  create(@Body() dto: CreateFaqDto) {
    return this.service.createFaq(dto);
  }

  @Patch('faqs/:code')
  update(@Param('code') code: string, @Body() dto: PatchFaqDto) {
    return this.service.updateFaq(code, dto);
  }

  @Delete('faqs/:code')
  remove(@Param('code') code: string) {
    return this.service.deleteFaq(code);
  }
}

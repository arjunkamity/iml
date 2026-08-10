import {
  Body,
  Controller,
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
import { FinanceService } from './finance.service';
import { CreatePaymentDto, PatchPaymentDto } from './finance.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('payments')
  list(@Query() q: ListQueryDto) {
    return this.service.listPayments(q);
  }

  @Get('payments/:code')
  get(@Param('code') code: string) {
    return this.service.getPayment(code);
  }

  @Post('payments')
  create(@Body() dto: CreatePaymentDto) {
    return this.service.createPayment(dto);
  }

  @Patch('payments/:code')
  update(@Param('code') code: string, @Body() dto: PatchPaymentDto) {
    return this.service.updatePayment(code, dto);
  }
}

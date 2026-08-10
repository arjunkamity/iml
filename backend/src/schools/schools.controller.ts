import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { JwtPayload } from '../auth/auth.types';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateSchoolDto) {
    return this.schools.create(dto);
  }

  @Roles('ADMIN')
  @Get()
  list() {
    return this.schools.list();
  }

  @Public()
  @Get('validate/:code')
  validate(@Param('code') code: string) {
    return this.schools.validateCode(code);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === 'COORDINATOR' && user.schoolId !== id) {
      throw new ForbiddenException('You can only view your own school');
    }
    return this.schools.getById(id);
  }
}

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
import { GradeService } from './grades.service';
import { CreateGradeDto, PatchGradeDto } from './grades.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class GradeController {
  constructor(private readonly service: GradeService) {}

  @Get('grades')
  list(@Query() q: ListQueryDto) {
    return this.service.listGrades(q);
  }

  @Get('grades/:name')
  get(@Param('name') name: string) {
    return this.service.getGrade(name);
  }

  @Post('grades')
  create(@Body() dto: CreateGradeDto) {
    return this.service.createGrade(dto);
  }

  @Patch('grades/:name')
  update(@Param('name') name: string, @Body() dto: PatchGradeDto) {
    return this.service.updateGrade(name, dto);
  }

  @Delete('grades/:name')
  remove(@Param('name') name: string) {
    return this.service.deleteGrade(name);
  }
}

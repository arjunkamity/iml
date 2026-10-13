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
import { QuestionCategoryService } from './question-categories.service';
import {
  CreateQuestionCategoryDto,
  PatchQuestionCategoryDto,
} from './question-categories.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class QuestionCategoryController {
  constructor(private readonly service: QuestionCategoryService) {}

  @Get('question-categories')
  list(@Query() q: ListQueryDto) {
    return this.service.listCategories(q);
  }

  @Get('question-categories/:name')
  get(@Param('name') name: string) {
    return this.service.getCategory(name);
  }

  @Post('question-categories')
  create(@Body() dto: CreateQuestionCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('question-categories/:name')
  update(@Param('name') name: string, @Body() dto: PatchQuestionCategoryDto) {
    return this.service.updateCategory(name, dto);
  }

  @Delete('question-categories/:name')
  remove(@Param('name') name: string) {
    return this.service.deleteCategory(name);
  }
}

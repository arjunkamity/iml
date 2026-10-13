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
import { SuperAdminGuard } from '../../auth/guards/super-admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ListQueryDto } from '../../common/list-query.dto';
import { AdminService } from './admins.service';
import { CreateAdminDto, PatchAdminDto } from './admins.dto';

@Controller()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminsController {
  constructor(private readonly service: AdminService) {}

  @Get('admins')
  list(@Query() q: ListQueryDto) {
    return this.service.listAdmins(q);
  }

  @Get('admins/:id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getAdmin(parseInt(id, 10) || user.sub);
  }

  @Post('admins')
  create(@Body() dto: CreateAdminDto) {
    return this.service.createAdmin(dto);
  }

  @Patch('admins/:id')
  update(@Param('id') id: string, @Body() dto: PatchAdminDto) {
    return this.service.updateAdmin(parseInt(id, 10), dto);
  }

  @Delete('admins/:id')
  remove(@Param('id') id: string) {
    return this.service.deleteAdmin(parseInt(id, 10));
  }
}

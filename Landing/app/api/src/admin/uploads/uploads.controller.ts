import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /** Media library listing — existing files the admin can pick from. */
  @Get('uploads')
  list(@Query('folder') folder?: string) {
    return this.storage.list(folder);
  }

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folderQuery?: string,
    @Body('folder') folderBody?: string,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded');
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const folder = folderQuery ?? folderBody ?? 'misc';
    return this.storage.upload(folder, file.originalname, file.buffer, file.mimetype);
  }
}

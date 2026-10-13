import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsIn(['all', 'students', 'schools', 'schools-all', 'schools-pending', 'unpaid', 'custom'])
  audience?: string;

  // Always optional, regardless of audience — additional one-off
  // addresses appended on top of the selected group, not a separate
  // mode. Raw admin-entered list, parsed at preview/send time (see
  // BroadcastService.parseCustomEmails).
  @IsOptional()
  @IsString()
  customEmails?: string;
}

export class PatchBroadcastDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  @IsOptional()
  @IsIn(['all', 'students', 'schools', 'schools-all', 'schools-pending', 'unpaid', 'custom'])
  audience?: string;

  @IsOptional()
  @IsString()
  customEmails?: string;
}

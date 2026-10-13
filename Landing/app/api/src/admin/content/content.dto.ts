import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export interface BulkUploadRowError {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  total: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
}

export class CreateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  grade!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  category!: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'video', 'image'])
  qtype?: string;

  @IsOptional()
  @IsString()
  media?: string;

  @IsOptional()
  @IsString()
  @IsIn(['single', 'multi'])
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ref?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitSecs?: number;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsOptional()
  @IsArray()
  options?: unknown[];

  @IsOptional()
  @IsArray()
  correct?: unknown[];

  // Demo-only question — pulled ONLY by the Default Demo Exam, never a
  // real one. See Question.isDemo in schema.prisma.
  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;
}

export class PatchQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'video', 'image'])
  qtype?: string;

  @IsOptional()
  @IsString()
  media?: string;

  @IsOptional()
  @IsString()
  @IsIn(['single', 'multi'])
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ref?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitSecs?: number;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsArray()
  options?: unknown[];

  @IsOptional()
  @IsArray()
  correct?: unknown[];

  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;
}

export class CreateExamDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionCount?: number;

  // How many times a student may take this exam. Unset = 1 (Prisma
  // default), same one-and-done behavior as before this field existed.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  timing?: unknown;

  @IsOptional()
  @IsIn(['Draft', 'Scheduled', 'Live', 'Closed'])
  status?: string;
}

export class PatchExamDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  timing?: unknown;

  @IsOptional()
  @IsIn(['Draft', 'Scheduled', 'Live', 'Closed'])
  status?: string;
}

// ---- exam batches (batch-wise access for high-volume exams) ----

export class CreateExamBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label!: string;

  // ISO datetime, e.g. "2026-09-01T10:00:00+05:30"
  @IsString()
  @IsNotEmpty()
  startAt!: string;

  @IsInt()
  @Min(1)
  durationMin!: number;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class PatchExamBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class AutoAssignBatchesDto {
  // If omitted, auto-assign spreads across every batch on the exam.
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  batchIds?: number[];
}

export class AssignRegistrationDto {
  @IsString()
  @IsNotEmpty()
  registrationCode!: string;
}

export class SendBatchReminderDto {
  @IsString()
  @IsIn(['GET_READY', 'GO_FOR_IT'])
  type!: 'GET_READY' | 'GO_FOR_IT';

  @IsArray()
  @IsIn(['email', 'sms'], { each: true })
  channels!: Array<'email' | 'sms'>;
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  audience?: string;

  @IsOptional()
  @IsString()
  publishOn?: string;

  @IsOptional()
  @IsIn(['Draft', 'Active'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

export class PatchAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  audience?: string;

  @IsOptional()
  @IsString()
  publishOn?: string;

  @IsOptional()
  @IsIn(['Draft', 'Active'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  author?: string;

  @IsOptional()
  @IsString()
  publishOn?: string;

  @IsOptional()
  @IsIn(['Draft', 'Published'])
  status?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class PatchNewsDto {
  @IsOptional()
  @IsString()
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  author?: string;

  @IsOptional()
  @IsString()
  publishOn?: string;

  @IsOptional()
  @IsIn(['Draft', 'Published'])
  status?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class CreateGalleryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsIn(['Public', 'Private'])
  visibility?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  photos?: unknown[];

  @IsOptional()
  @IsString()
  status?: string;
}

export class PatchGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsIn(['Public', 'Private'])
  visibility?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  photos?: unknown[];

  @IsOptional()
  @IsString()
  status?: string;
}

export class PatchGrievanceDto {
  @IsString()
  @IsIn(['New', 'In Progress', 'Resolved'])
  status!: string;
}

export class ReplyGrievanceDto {
  // At least one of the two — a reply message, a status change, or both
  // in one submit (typical "reply + close" ticketing action).
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @IsIn(['New', 'In Progress', 'Resolved'])
  status?: string;
}

export class CreateNotificationDto {
  @IsString()
  @IsIn(['EMAIL', 'SMS'])
  channel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  audience!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsBoolean()
  html?: boolean;
}

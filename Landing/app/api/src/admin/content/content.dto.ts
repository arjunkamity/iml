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
  @IsIn(['IQ', 'EQ', 'Values'])
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
  @IsIn(['IQ', 'EQ', 'Values'])
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
  timing?: unknown;

  @IsOptional()
  @IsIn(['Draft', 'Scheduled', 'Live', 'Closed'])
  status?: string;
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

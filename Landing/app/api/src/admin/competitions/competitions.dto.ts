import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StageDto {
  @IsInt()
  @Min(1)
  position!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(['Online', 'Offline', 'Hybrid', 'Peer Interview'])
  mode!: string;

  @IsNumber()
  passMark!: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  title!: string;

  @IsString()
  @MaxLength(20)
  grades!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsIn(['Draft', 'Open', 'Live', 'Closed', 'Archived'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isMulti?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsIn(['PERCENT', 'GRADE', 'FRACTION'])
  scoringMode?: string;

  @IsOptional()
  @IsIn(['INSTANT', 'MANUAL'])
  certificateMode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageDto)
  stages?: StageDto[];
}

export class PatchCompetitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grades?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsIn(['Draft', 'Open', 'Live', 'Closed', 'Archived'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isMulti?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsIn(['PERCENT', 'GRADE', 'FRACTION'])
  scoringMode?: string;

  @IsOptional()
  @IsIn(['INSTANT', 'MANUAL'])
  certificateMode?: string;
}

export class CreateStageDto {
  @IsInt()
  @Min(1)
  position!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(['Online', 'Offline', 'Hybrid', 'Peer Interview'])
  mode!: string;

  @IsNumber()
  passMark!: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  // null/omitted = no cap, every attempt clearing passMark qualifies
  // immediately (today's behavior). Set = qualifying is deferred to a
  // ranked selection run once the stage closes — see SelectionService.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQualifiers?: number;
}

export class PatchStageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Online', 'Offline', 'Hybrid', 'Peer Interview'])
  mode?: string;

  @IsOptional()
  @IsNumber()
  passMark?: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQualifiers?: number | null;
}

export class CreatePrizeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  competitionCode!: string;

  @IsString()
  @IsIn(['1st', '2nd', '3rd', 'Consolation'])
  rankLabel!: string;

  @IsOptional()
  @IsNumber()
  money?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  award?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class PatchPrizeDto {
  @IsOptional()
  @IsString()
  @IsIn(['1st', '2nd', '3rd', 'Consolation'])
  rankLabel?: string;

  @IsOptional()
  @IsNumber()
  money?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  award?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

// One row of a competition's question mix: how many questions of this
// category each student is served. See CompetitionQuestionRule and
// StudentService.drawQuestions.
export class QuestionMixRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  category!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;
}

// PUT replaces the whole mix; an empty list clears it (back to "use every
// tagged question", the original behaviour).
export class PutQuestionMixDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => QuestionMixRuleDto)
  rules!: QuestionMixRuleDto[];
}

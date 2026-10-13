import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateAssessmentCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class PatchAssessmentCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAssessmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number | null;

  // "9-12" or "9,10,11,12"; empty = every grade.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  grades?: string;

  // Start as a copy of an existing assessment (its scoring set-up and all of
  // its questions) — the way to publish a corrected "new version".
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cloneFrom?: string;
}

export class PatchAssessmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grades?: string;

  @IsOptional()
  @IsString()
  consent?: string;

  @IsOptional()
  @IsString()
  disclaimer?: string;

  @IsOptional()
  @IsString()
  howScored?: string;

  // The capacities and their bands. Validated by the service (shape, unique
  // keys, band ranges); locked once anyone has completed the assessment.
  @IsOptional()
  @IsArray()
  dimensions?: unknown[];
}

export class AssessmentQuestionDto {
  // Capacity key, e.g. THINK — must be one of the assessment's capacities.
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  capacity!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options!: string[];

  // Points each option scores, same order as options.
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsNumber({}, { each: true })
  points!: number[];
}

export class PatchAssessmentQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  capacity?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsNumber({}, { each: true })
  points?: number[];
}

export class PreviewAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt()
  optionIndex!: number;
}

export class PreviewScoreDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewAnswerDto)
  answers!: PreviewAnswerDto[];
}

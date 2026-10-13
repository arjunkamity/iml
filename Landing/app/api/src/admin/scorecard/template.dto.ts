import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Start as a copy of an existing template (all sections, labels and colours).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cloneFrom?: string;
}

export class PatchTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // The whole layout (branding and sections). Only a Draft can be edited.
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class GenerateReportsDto {
  // Limit to these students (codes); empty = every student with a finished attempt in the stage.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  students?: string[];

  // Make a new version for students who already have a report.
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}

export class ReleaseDto {
  // One stage, or every stage when left out.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  stage?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  students?: string[];

  // Release even though some of the wording the template asks for was missing.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class WithdrawDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  stage?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  students?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class SendToParentsDto {
  @IsInt()
  @Min(0)
  @Max(12)
  stage!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  students?: string[];
}

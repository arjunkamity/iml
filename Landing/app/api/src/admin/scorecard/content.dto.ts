import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLibraryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultLanguage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  languages?: string[];

  // Start as a copy of another library: its current wording becomes drafts here (nothing is approved yet).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cloneFrom?: string;
}

export class PatchLibraryDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultLanguage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  languages?: string[];
}

export class SaveTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  kind!: string;

  // The competency or dimension (or a stage number), "*" for the default, empty for kinds with none.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  key?: string;

  // The level, or empty when the text is for any level.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  levelKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  // Order within a list (week number, question number); ignored for kinds that are not lists.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  text!: string;
}

export class ApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class BulkApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class ImportTextsDto {
  @IsString()
  @IsNotEmpty()
  csv!: string;

  // Check and report without saving anything.
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PreviewTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  // Read the drafts instead of the approved wording.
  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  // Sample values for the placeholders.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dimension?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  competency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  levelLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  edition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  competition?: string;
}

// A template typed in the editor, rendered with sample values before it is saved.
export class PreviewTemplateDto {
  @IsString()
  @MaxLength(6000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dimension?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  competency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  levelLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  edition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  competition?: string;
}

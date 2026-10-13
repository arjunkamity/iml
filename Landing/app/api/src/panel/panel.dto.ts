import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ---- panel forms (#75)
export class CreatePanelFormDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  // Start as a copy of another panel form (competencies, options, hints, weights, settings).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cloneFrom?: string;
}

export class PatchPanelFormDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CompetencyDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  // The framework dimension this competency belongs to (THINK, FEEL ...).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  dimension?: string;

  // What the panelist observes.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  points?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  weight?: number;

  // Fill the options, points and hints from a level scale instead.
  @IsOptional()
  @IsBoolean()
  useStandardScale?: boolean;

  // The framework whose default scale to use (the standard IML scale when left out).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  frameworkCode?: string;
}

// ---- panelists and stages (#76, #78)
export class CreatePanelistDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PatchPanelistDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StageSetupDto {
  // The evaluation form (panel assessment code); empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  formCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  requiredRaters?: number;
}

export class EnrolDto {
  @IsInt()
  panelistId!: number;

  // Schools whose students this panelist must not rate.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  conflictSchools?: number[];
}

export class ConflictsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  conflictSchools!: number[];
}

export class CloseDto {
  // Confirms the warnings (drafts left, students with too few ratings).
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class FinalizeDto {
  // Finalize even though some disagreements have not been decided.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class OverrideDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class AdjudicateDto {
  // Points per competency code, replacing the panelists' average.
  @IsObject()
  overrides!: Record<string, number>;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ReopenRatingDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

// ---- panel login and portal (#77, #79, #80)
export class PanelLoginDto {
  // Email or phone.
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

export class PanelVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  challenge!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code!: string;
}

export class PanelSetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}

export class PanelForgotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  userId!: string;
}

export class RatingItemDto {
  @IsInt()
  @Min(0)
  optionIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SaveRatingDto {
  // competency code -> chosen option (and comment)
  @IsObject()
  ratings!: Record<string, RatingItemDto>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  // true = submit and lock; false/absent = save a draft.
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class NarrativeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;
}

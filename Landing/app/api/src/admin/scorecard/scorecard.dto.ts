import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateFrameworkDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Start as a copy of an existing framework (all dimensions, scales and competencies).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cloneFrom?: string;
}

export class PatchFrameworkDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // The whole configuration (dimensions, scales, defaultScale, competencies). Replaces
  // the stored one. Only a Draft can be edited; publishing runs the full validation.
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateSeasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  editionLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  idPattern?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  frameworkCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  scaleKey?: string;

  // The wording library its reports use.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  libraryCode?: string;

  // The report layout its reports use.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  templateCode?: string;

  // How reports are released and shared (consentRequired, notifyStudent, linkValidDays).
  @IsOptional()
  @IsObject()
  deliverySettings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PatchSeasonDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  editionLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  idPattern?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  frameworkCode?: string;

  // Empty string clears it (the framework's default scale is used).
  @IsOptional()
  @IsString()
  @MaxLength(30)
  scaleKey?: string;

  // Empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  libraryCode?: string;

  // Empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  templateCode?: string;

  @IsOptional()
  @IsObject()
  deliverySettings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SeasonCompetitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  competitionCode!: string;

  // Optional override of the season's default scale for this competition.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  scaleKey?: string;
}

export class SeasonCompetitionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SeasonCompetitionDto)
  competitions!: SeasonCompetitionDto[];
}

export class ImportBundleDto {
  @IsObject()
  bundle!: Record<string, unknown>;

  // true (the default) only checks the file and reports what it would create
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CopySeasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  editionLabel!: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

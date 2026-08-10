import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsIn(['Draft', 'Open', 'Live', 'Closed'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isMulti?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

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
  @IsIn(['Draft', 'Open', 'Live', 'Closed'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isMulti?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
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

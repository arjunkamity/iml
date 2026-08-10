import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSponsorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(['Gold', 'Silver', 'Bronze'])
  tier?: string;

  @IsOptional()
  @IsIn(['Active', 'Disabled', 'Pending'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  since?: string;

  @IsOptional()
  @IsString({ each: true })
  competitionCodes?: string[];
}

export class PatchSponsorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(['Gold', 'Silver', 'Bronze'])
  tier?: string;

  @IsOptional()
  @IsIn(['Active', 'Disabled', 'Pending'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  since?: string;

  @IsOptional()
  @IsString({ each: true })
  competitionCodes?: string[];
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount!: number;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  extras?: unknown[];

  @IsOptional()
  active?: boolean;
}

export class PatchPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  extras?: unknown[];

  @IsOptional()
  active?: boolean;
}

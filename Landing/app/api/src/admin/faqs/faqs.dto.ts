import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PatchFaqDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OptionDto {
  @IsString()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateQuestionDto {
  @IsIn(['IQ', 'EQ', 'VAL'])
  categoryCode!: 'IQ' | 'EQ' | 'VAL';

  @IsString()
  questionText!: string;

  @IsOptional()
  @IsIn(['Easy', 'Medium', 'Hard'])
  difficulty?: 'Easy' | 'Medium' | 'Hard';

  @IsOptional()
  @IsNumber()
  marks?: number;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[];
}

import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateQuizDto {
  @IsString()
  title!: string;

  @IsIn(['Practice', 'Mock', 'Qualifier'])
  quizType!: 'Practice' | 'Mock' | 'Qualifier';

  @IsInt()
  @Min(10)
  durationSeconds!: number;

  @IsInt()
  @Min(1)
  totalQuestions!: number;

  @IsOptional()
  @IsNumber()
  markPerCorrect?: number;

  @IsOptional()
  @IsNumber()
  markPerWrong?: number;

  @IsOptional()
  @IsBoolean()
  isRandomized?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;
}

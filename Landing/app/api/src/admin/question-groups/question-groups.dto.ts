import { ArrayMaxSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuestionGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  // A YouTube link or an uploaded video URL, same as a question's media.
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  competitionCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  category!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Question codes in the order they are served. Optional on create so a
  // group can be started as an inactive draft and filled in afterwards.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  questionCodes?: string[];
}

export class PatchQuestionGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  category?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // When present, replaces the group's sub-questions and their order.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  questionCodes?: string[];
}

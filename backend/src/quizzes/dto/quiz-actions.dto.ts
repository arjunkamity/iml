import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class AttachQuestionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  questionIds!: number[];
}

export class SaveAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt()
  optionId!: number;
}

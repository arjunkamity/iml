import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InitiatePaymentDto {
  @IsInt()
  stageId!: number;
}

export class UpdateStudentProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  gender?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  school?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreateStudentGrievanceDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['Complaint', 'Feedback', 'Suggestion'])
  gtype!: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export class AddGrievanceReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export class AnswerDto {
  @IsNotEmpty()
  questionId!: number;

  @IsOptional()
  answer?: (number | string)[];

  @IsOptional()
  takenSecs?: number;

  @IsOptional()
  timeUp?: boolean;

  // How many times the student changed this question's answer before
  // submitting — see AttemptAnswer.changeCount. Purely a ranked stage
  // selection tie-break signal, never used in scoring.
  @IsOptional()
  changeCount?: number;
}

export class SubmitAttemptDto {
  @IsString()
  @IsNotEmpty()
  attemptCode!: string;

  @IsOptional()
  answers?: AnswerDto[];

  // See Attempt.clientElapsedSecs.
  @IsOptional()
  clientElapsedSecs?: number;
}

// Periodic autosave while an exam is in progress — see
// StudentService.saveProgress(). Deliberately much lighter than
// SubmitAttemptDto: no scoring happens here, just durable storage of
// whatever's been answered so far, so a real disconnect (closed tab,
// crashed browser, dead battery) has something to resume from beyond
// what sessionStorage on that one browser instance still remembers.
export class SaveProgressDto {
  @IsString()
  @IsNotEmpty()
  attemptCode!: string;

  @IsOptional()
  answers?: AnswerDto[];

  // Which question the student was looking at when this save fired —
  // resume jumps back here instead of always question 1.
  @IsOptional()
  @IsInt()
  lastQuestionId?: number;
}

export class SetStudentPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}

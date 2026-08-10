import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

export class StudentLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

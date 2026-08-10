import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class RegisterStudentDto {
  @IsString()
  schoolCode!: string;

  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string; // OTP sent to phone

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

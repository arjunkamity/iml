import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const NAME_RE = /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u;
const PHONE_RE = /^\d{10}$/;

class DemoAnswerDto {
  @IsInt()
  questionId!: number;

  @IsOptional()
  @IsArray()
  answer?: (number | string)[];
}

export class SubmitDemoExamDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DemoAnswerDto)
  answers?: DemoAnswerDto[];
}

export class PublicRegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(NAME_RE, {
    message: 'Student name should contain only letters (no numbers or symbols).',
  })
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  grade!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_RE, {
    message: 'Enter a valid 10-digit mobile number.',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  @Matches(NAME_RE, {
    message: 'Parent name should contain only letters (no numbers or symbols).',
  })
  @MaxLength(120)
  parent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  school?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  competitionCode?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code sent to your email.' })
  otp!: string;
}

export class RequestRegisterOtpDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(190)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_RE, { message: 'Enter a valid 10-digit mobile number.' })
  phone?: string;
}

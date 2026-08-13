import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const NAME_RE = /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u;
const PHONE_RE = /^\d{10}$/;

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
}

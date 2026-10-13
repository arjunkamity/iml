import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

/** Step 1 of school self-signup: proves the coordinator controls the
 * email/phone they're about to register with, before any School row
 * exists for it yet. Own purpose ('school-register') rather than reusing
 * 'school-login' — that one looks up an *existing* school by email/phone
 * first, which doesn't apply here. See AuthService.requestSchoolRegisterOtp. */
export class RequestSchoolRegisterOtpDto {
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;
}

/** Step 2: creates the School row itself. Unlike every admin-created
 * school, the coordinator sets their own real password right here — no
 * bootstrap phone-number password, no forced first-login. See
 * AuthService.registerSchool. */
export class SchoolRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactSecondary?: string;

  // The school's own institutional address — see School.schoolEmail.
  // Optional and separate from `email` below (the coordinator's own
  // login identity).
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  schoolEmail?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  coordinator!: string;

  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

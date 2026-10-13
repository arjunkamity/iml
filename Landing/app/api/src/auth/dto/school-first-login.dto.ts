import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';

/** Completes the forced first-login flow (default-password-is-your-phone-
 * number schools): proves ownership of the registered email/phone via the
 * OTP that was auto-sent at login, and sets a real password in the same
 * step. See AuthService.completeSchoolFirstLogin. */
export class SchoolFirstLoginDto {
  @Type(() => Number)
  @IsInt()
  schoolId!: number;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}

export class SchoolFirstLoginResendDto {
  @Type(() => Number)
  @IsInt()
  schoolId!: number;
}

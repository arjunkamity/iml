import { IsIn, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  target!: string; // phone or email

  @IsIn(['SMS', 'Email'])
  channel!: 'SMS' | 'Email';

  @IsIn(['Registration', 'Login'])
  purpose!: 'Registration' | 'Login';
}

export class VerifyOtpDto {
  @IsString()
  target!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

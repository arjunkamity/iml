import { IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

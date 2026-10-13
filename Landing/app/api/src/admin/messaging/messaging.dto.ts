import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMessageTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  smsBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailBody?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class TestSendDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

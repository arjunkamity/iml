import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  grade!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(190)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
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

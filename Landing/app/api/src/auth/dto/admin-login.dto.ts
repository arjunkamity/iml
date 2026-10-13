import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

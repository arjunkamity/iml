import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StudentLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(190)
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

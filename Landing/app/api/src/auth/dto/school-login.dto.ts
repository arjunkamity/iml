import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

/** Unlike StudentLoginDto, a school signs in with EITHER its registered
 * email or phone (whichever the admin set) — see AuthService.schoolLogin. */
export class SchoolLoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

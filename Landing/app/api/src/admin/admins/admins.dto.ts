import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(['Super Admin', 'Editor', 'Viewer'])
  role?: string;

  @IsOptional()
  @IsIn(['Active', 'Disabled'])
  status?: string;

  @IsOptional()
  @IsString({ each: true })
  modules?: string[];
}

export class PatchAdminDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(['Super Admin', 'Editor', 'Viewer'])
  role?: string;

  @IsOptional()
  @IsIn(['Active', 'Disabled'])
  status?: string;

  @IsOptional()
  @IsString({ each: true })
  modules?: string[];
}

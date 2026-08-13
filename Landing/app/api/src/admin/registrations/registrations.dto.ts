import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RegistrationStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  grade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  schoolCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parent?: string;
}

export class CreateRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  competitionCode!: string;

  @ValidateNested()
  @Type(() => RegistrationStudentDto)
  student!: RegistrationStudentDto;
}

export class PatchRegistrationDto {
  @IsOptional()
  @IsString()
  @IsIn(['Registered', 'Test Taken', 'Qualified', 'Eliminated'])
  status?: string;
}

class PaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTxn?: string;
}

export class AcceptStageDto {
  @IsInt()
  @Min(1)
  position!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;
}

export class CreateStudentDto extends RegistrationStudentDto {}

export class PatchStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  schoolCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parent?: string;
}

export class CreateSchoolDto {
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
  @MaxLength(120)
  coordinator?: string;
}

export class PatchSchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(190)
  name?: string;

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
  @MaxLength(120)
  coordinator?: string;
}

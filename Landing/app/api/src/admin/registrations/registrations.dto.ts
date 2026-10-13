import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
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
  @MaxLength(40)
  contactSecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinator?: string;

  // The school's own official/institutional address — see School.schoolEmail.
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  schoolEmail?: string;

  // The school's own login identity for /schools — see School.email/phone.
  // Neither required at creation; a school just can't sign in until one
  // is set.
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  // Set true to force-create even though a very-similar-named school
  // already exists — see RegistrationService.createSchool()'s duplicate
  // check. Only meaningful on retry after that check has already refused
  // once and the admin has confirmed this genuinely is a different school
  // (e.g. two real schools that happen to share a name).
  @IsOptional()
  @IsBoolean()
  confirmNew?: boolean;
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
  @MaxLength(40)
  contactSecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinator?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  schoolEmail?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

// Admin-authored password override for a School or a Student (via their
// registration code) — see RegistrationService.setSchoolPassword() /
// setStudentPasswordByAdmin(). Deliberately no currentPassword field:
// unlike the self-service change-password endpoints, this is an admin
// acting on someone else's account, not the account owner authenticating
// themselves — there's nothing for them to "prove" here.
export class AdminSetPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}

export interface BulkUploadRowError {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  total: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
}

// Merge two Schools or two Students — `keepCode` survives untouched
// (name/login/coordinator/etc. all stay exactly as they are today),
// `mergeCode` is the duplicate being absorbed into it. See
// RegistrationService.mergeSchools()/mergeStudents() for what actually
// moves.
export class MergeDto {
  @IsString()
  @IsNotEmpty()
  keepCode!: string;

  @IsString()
  @IsNotEmpty()
  mergeCode!: string;
}

// Which of a school's two hats the Magic Link popup says the link is for.
// Today both land in the same single school portal account (a School has
// one login identity) — recorded only so the choice isn't lost if the two
// ever become separate accounts. See RegistrationService.generateSchoolLoginLink().
export class SchoolLoginLinkDto {
  @IsIn(['admin', 'coordinator'])
  loginAs!: 'admin' | 'coordinator';
}

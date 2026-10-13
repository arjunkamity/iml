import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Deliberately excludes email/phone — those are the school's own login
 * identity, admin-managed (see Admin > Schools) to avoid a school locking
 * itself out by mistyping its own sign-in address. Everything else here
 * is what the school itself sees as "school information". */
export class UpdateSchoolProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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

export class SetSchoolPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}

/** Editing an already-registered student's own details — never touches
 * which competition/registration they're under, just the person. */
export class UpdateSchoolStudentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  grade?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parent?: string;
}

/** A school adding one of its own students — always tied to this
 * school (the schoolId is never taken from the request, only from the
 * authenticated school's own id) and to a competition the school picks
 * from what's currently open, mirroring the admin "New registration"
 * form's own required competitionCode field. */
export class AddSchoolStudentDto {
  @IsString()
  @IsNotEmpty()
  competitionCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  grade!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parent?: string;
}

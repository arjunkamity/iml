import { IsNotEmpty, IsString } from 'class-validator';

export class ConsumeSchoolLinkDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

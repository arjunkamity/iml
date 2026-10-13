import { IsNotEmpty, IsString } from 'class-validator';

export class ConsumeAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  sid!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}

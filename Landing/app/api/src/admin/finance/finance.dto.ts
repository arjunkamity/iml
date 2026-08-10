import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  registrationCode!: string;

  @IsOptional()
  @IsNumber()
  stageId?: number;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsIn(['UPI', 'Card', 'Net Banking', 'Offline'])
  mode!: string;

  @IsOptional()
  @IsIn(['Pending', 'Paid', 'Failed'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTxn?: string;
}

export class PatchPaymentDto {
  @IsOptional()
  @IsIn(['Pending', 'Paid', 'Failed'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTxn?: string;
}

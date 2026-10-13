import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  comp?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  // School.code — used by Registrations/Payments listing+export filters.
  // Distinct from `search`, which only matches student/code text, not the
  // school the student belongs to.
  @IsOptional()
  @IsString()
  school?: string;

  // Payments export date range, inclusive — matched against Payment.createdAt.
  // ISO date strings (yyyy-mm-dd); no time-of-day component is expected.
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  // Registrations listing/export only — distinct from `status` (the
  // Registration's own lifecycle status), since a registration can sit in
  // any status while its payment is Paid/Pending/Failed independently.
  // 'Unpaid' is synthetic (no matching Payment enum value): "no Paid
  // payment exists yet", covering both zero payments and payments stuck
  // at Pending/Failed.
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsString()
  gtype?: string;

  // Question Bank's "Demo" filter — 'Demo only' | 'Real only'.
  @IsOptional()
  @IsString()
  demo?: string;

  // Question Bank only: 'Grouped' | 'Ungrouped' (Question Groups).
  @IsOptional()
  @IsString()
  group?: string;
}

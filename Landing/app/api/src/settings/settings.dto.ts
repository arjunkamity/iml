import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateSiteSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoLightUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoDarkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoMobileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  officeAddress?: string;

  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @IsOptional()
  @IsString()
  registrationDeadline?: string;

  @IsOptional()
  @IsString()
  gaScript?: string;

  @IsOptional()
  @IsString()
  analyticsEmbedUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  loadingText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  loadingImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  participateTitle?: string;

  @IsOptional()
  @IsString()
  participateIntro?: string;

  @IsOptional()
  @IsString()
  participateBullets?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  participateBtnText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  participateBtnLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  participatePhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  whyJoinTitle?: string;

  @IsOptional()
  @IsString()
  whyJoinBullets?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  whyJoinBtnText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  whyJoinBtnLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  videoCaption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certBackgroundUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certImlLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certAmityLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certBadgeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certSigLeftImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certSigLeftName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certSigLeftRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  certSigRightImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certSigRightName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certSigRightRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  certDescriptionTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  demoExamTitle?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  demoExamDurationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  demoExamQuestionCount?: number;

  @IsOptional()
  @IsBoolean()
  demoExamActive?: boolean;

  @IsOptional()
  @IsBoolean()
  showQuestionHistory?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultCompetitionCode?: string;
}

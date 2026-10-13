import { CertificateBrandAssets } from './templates/participation-v1';

/** Shape of the columns on SiteSetting this module cares about — avoids a
 * hard dependency on the generated Prisma client type so this file stays
 * usable from the standalone proof script too. */
export interface CertificateSiteSettingRow {
  certBackgroundUrl?: string | null;
  certImlLogoUrl?: string | null;
  certAmityLogoUrl?: string | null;
  certBadgeUrl?: string | null;
  certSigLeftImageUrl?: string | null;
  certSigLeftName?: string | null;
  certSigLeftRole?: string | null;
  certSigRightImageUrl?: string | null;
  certSigRightName?: string | null;
  certSigRightRole?: string | null;
  certDescriptionTemplate?: string | null;
}

function undef(v: string | null | undefined): string | undefined {
  return v ?? undefined;
}

/** Maps the admin-configured SiteSetting row onto the template's brand
 * asset shape. A signature block is included only when there's something
 * to show for it — otherwise the template's own defaults (role labels)
 * or empty placeholder (image) take over. */
export function siteSettingToBrandAssets(setting: CertificateSiteSettingRow | null | undefined): CertificateBrandAssets {
  if (!setting) return {};
  return {
    backgroundUrl: undef(setting.certBackgroundUrl),
    imlLogoUrl: undef(setting.certImlLogoUrl),
    amityLogoUrl: undef(setting.certAmityLogoUrl),
    badgeUrl: undef(setting.certBadgeUrl),
    signatureLeft: {
      imageUrl: undef(setting.certSigLeftImageUrl),
      name: setting.certSigLeftName || 'Program Director',
      role: setting.certSigLeftRole || 'India Mind League',
    },
    signatureRight: {
      imageUrl: undef(setting.certSigRightImageUrl),
      name: setting.certSigRightName || 'Registrar',
      role: setting.certSigRightRole || 'Amity Group of Schools',
    },
    descriptionTemplate: undef(setting.certDescriptionTemplate),
  };
}

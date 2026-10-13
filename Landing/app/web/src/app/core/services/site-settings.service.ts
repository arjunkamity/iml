import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface SiteSettings {
  logoLightUrl: string;
  logoDarkUrl: string;
  logoMobileUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string;
  officeAddress: string;
  googleMapsUrl: string;
  registrationDeadline: string;
  gaScript: string;
  loadingText: string;
  loadingImageUrl: string;
  participateTitle: string;
  participateIntro: string;
  participateBullets: string;
  participateBtnText: string;
  participateBtnLink: string;
  participatePhotoUrl: string;
  whyJoinTitle: string;
  whyJoinBullets: string;
  whyJoinBtnText: string;
  whyJoinBtnLink: string;
  videoUrl: string;
  videoCaption: string;
}

interface SiteSettingResponse {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoMobileUrl: string | null;
  faviconUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  officeAddress: string | null;
  googleMapsUrl: string | null;
  registrationDeadline: string | null;
  gaScript: string | null;
  loadingText: string | null;
  loadingImageUrl: string | null;
  participateTitle: string | null;
  participateIntro: string | null;
  participateBullets: string | null;
  participateBtnText: string | null;
  participateBtnLink: string | null;
  participatePhotoUrl: string | null;
  whyJoinTitle: string | null;
  whyJoinBullets: string | null;
  whyJoinBtnText: string | null;
  whyJoinBtnLink: string | null;
  videoUrl: string | null;
  videoCaption: string | null;
}

// Matches what was hardcoded across the site before settings existed — used
// wherever the admin hasn't configured a value yet, so behaviour is unchanged
// until someone actually fills in Site Settings.
const DEFAULTS: SiteSettings = {
  logoLightUrl: 'img/new-logo-cut.png',
  logoDarkUrl: 'img/new-logo-cut.png',
  logoMobileUrl: 'img/new-logo-cut.png',
  faviconUrl: 'favicon.ico',
  contactEmail: 'indiamindleague@gmail.com',
  contactPhone: '',
  officeAddress: '',
  googleMapsUrl: '',
  // Matches the placeholder that was hardcoded in home.page.ts before this setting existed.
  registrationDeadline: '2026-12-31T23:59:59',
  gaScript: '',
  loadingText: '',
  loadingImageUrl: '',
  participateTitle: 'Who Can Participate?',
  participateIntro: 'Curious, ambitious and creative students ready to challenge themselves:',
  participateBullets: [
    'Students of Classes IX to XII',
    'Recognized schools across Delhi NCR (Pilot Edition)',
    'Individual registration or school nomination',
    'All boards — CBSE, ICSE, IB, Cambridge & State',
  ].join('\n'),
  participateBtnText: 'Eligibility Details →',
  participateBtnLink: '/terms',
  participatePhotoUrl: 'img/cta-5-1.png',
  whyJoinTitle: 'Why Join IML?',
  whyJoinBullets: [
    'Enhance Knowledge & Skills',
    'National Level Exposure',
    'Exciting Rewards & Recognition',
    'Build Lifelong Connections',
  ].join('\n'),
  whyJoinBtnText: 'Explore More →',
  whyJoinBtnLink: '/#why',
  videoUrl: 'videos/school_campus.mp4',
  videoCaption: 'Watch IML in Action',
};

const CACHE_KEY = 'iml_site_settings_v1';

@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
  private readonly api = inject(ApiService);

  readonly settings = signal<SiteSettings>(this.readCache() ?? DEFAULTS);
  readonly loaded = signal(false);
  private gaInjected = false;

  /** Fetch once at app bootstrap. Safe to call more than once (idempotent-ish). */
  load() {
    return this.api.get<SiteSettingResponse>('/public/settings').pipe(
      map((res) => this.merge(res)),
      tap((merged) => {
        this.settings.set(merged);
        this.loaded.set(true);
        this.writeCache(merged);
        this.applyFavicon(merged.faviconUrl);
        this.applyGaScript(merged.gaScript);
      }),
      catchError(() => {
        // No settings configured yet (or the call failed) — fall back to
        // whatever we already have (cache or hardcoded defaults) rather
        // than breaking the site.
        this.loaded.set(true);
        return of(this.settings());
      }),
    );
  }

  private readCache(): SiteSettings | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as SiteSettings) : null;
    } catch {
      return null;
    }
  }

  private writeCache(s: SiteSettings) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {
      /* ignore quota/privacy-mode errors */
    }
  }

  private merge(res: SiteSettingResponse): SiteSettings {
    const out = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof SiteSettings)[]) {
      const v = res[key];
      if (v) out[key] = v;
    }
    return out;
  }

  private applyFavicon(url: string) {
    if (!url) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  /**
   * Admin-provided tracking snippet (e.g. GA4's gtag.js pair). Setting this
   * requires backend admin auth (@Roles('admin')), same trust level as any
   * other CMS's "paste your analytics script" field — but <script> tags
   * inserted via innerHTML never execute, so each one is recreated as a real
   * <script> element to actually run.
   */
  private applyGaScript(html: string) {
    if (!html?.trim() || this.gaInjected) return;
    this.gaInjected = true;
    const container = document.createElement('div');
    container.innerHTML = html;
    for (const old of Array.from(container.querySelectorAll('script'))) {
      const el = document.createElement('script');
      for (const attr of Array.from(old.attributes)) el.setAttribute(attr.name, attr.value);
      if (old.textContent) el.textContent = old.textContent;
      document.head.appendChild(el);
    }
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';
import { MediaLibraryModal } from './media-library-modal';

interface SiteSetting {
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
  analyticsEmbedUrl: string | null;
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
  certBackgroundUrl: string | null;
  certImlLogoUrl: string | null;
  certAmityLogoUrl: string | null;
  certBadgeUrl: string | null;
  certSigLeftImageUrl: string | null;
  certSigLeftName: string | null;
  certSigLeftRole: string | null;
  certSigRightImageUrl: string | null;
  certSigRightName: string | null;
  certSigRightRole: string | null;
  certDescriptionTemplate: string | null;
  demoExamTitle: string | null;
  demoExamDurationMin: number | null;
  demoExamQuestionCount: number | null;
  demoExamActive: boolean;
  showQuestionHistory: boolean;
  defaultCompetitionCode: string | null;
}

type ImageField =
  | 'logoLightUrl'
  | 'logoDarkUrl'
  | 'logoMobileUrl'
  | 'faviconUrl'
  | 'loadingImageUrl'
  | 'participatePhotoUrl'
  | 'certBackgroundUrl'
  | 'certImlLogoUrl'
  | 'certAmityLogoUrl'
  | 'certBadgeUrl'
  | 'certSigLeftImageUrl'
  | 'certSigRightImageUrl';

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, MediaLibraryModal],
  template: `
    <div class="bar">
      <div class="grow"></div>
      <button class="btn btn-gold" [disabled]="saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save Changes' }}
      </button>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else {
      <div class="grid" style="display:grid; gap:1.1rem;">
        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Logo</h3>
          <p class="hint" style="margin:-0.4rem 0 0.9rem;">Pick from previously uploaded files or upload a new one. Leave blank to keep the site default.</p>
          <div class="f-row">
            <div class="f">
              <label>Light background logo</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'logoLightUrl' }" />
              <div class="hint">Used where the logo sits on a light/white background.</div>
            </div>
            <div class="f">
              <label>Dark background logo</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'logoDarkUrl' }" />
              <div class="hint">Used in the main nav, footer and account header (dark backgrounds).</div>
            </div>
          </div>
          <div class="f">
            <label>Mobile logo</label>
            <ng-container *ngTemplateOutlet="picker; context: { field: 'logoMobileUrl' }" />
            <div class="hint">Used in the mobile nav / compact header. Falls back to the dark logo if left blank.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Favicon</h3>
          <div class="f">
            <label>Favicon</label>
            <ng-container *ngTemplateOutlet="picker; context: { field: 'faviconUrl' }" />
            <div class="hint">.ico or .png — shown in the browser tab.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Contact</h3>
          <div class="f-row">
            <div class="f">
              <label>Contact email</label>
              <input [(ngModel)]="form['contactEmail']" type="email" placeholder="indiamindleague@gmail.com" />
            </div>
            <div class="f">
              <label>Contact phone</label>
              <input [(ngModel)]="form['contactPhone']" placeholder="+91 98765 43210" />
            </div>
          </div>
          <div class="f">
            <label>Office address</label>
            <textarea [(ngModel)]="form['officeAddress']" rows="3" placeholder="e.g. Amity Group of Schools, Sector 44, Noida, Uttar Pradesh 201303"></textarea>
            <div class="hint">Shown in the Contact sidebar on the public site. Leave blank to hide the address line.</div>
          </div>
          <div class="f">
            <label>Google Maps link</label>
            <input [(ngModel)]="form['googleMapsUrl']" placeholder="https://maps.app.goo.gl/..." />
            <div class="hint">In Google Maps: search the address → Share → Copy link, then paste it here. Shown as a "View on Google Maps" link under the address — only appears once the address above is also set.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Countdown Timer</h3>
          <div class="f">
            <label>Stage 1 registrations close at</label>
            <input [(ngModel)]="form['registrationDeadline']" type="datetime-local" style="max-width: 280px;" />
            <div class="hint">Drives the "Stage 1 registrations close in" countdown on the homepage. Uses your browser's local time zone.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Google Analytics</h3>
          <div class="f">
            <label>Tracking script</label>
            <textarea [(ngModel)]="form['gaScript']" rows="5" placeholder="&lt;script async src=&quot;https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX&quot;&gt;&lt;/script&gt;&#10;&lt;script&gt;...&lt;/script&gt;"></textarea>
            <div class="hint">Paste the full snippet from Google Analytics. Injected into the page &lt;head&gt; as-is — leave blank to disable tracking.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Loading Screen</h3>
          <div class="f-row">
            <div class="f">
              <label>Loading text</label>
              <input [(ngModel)]="form['loadingText']" placeholder="Loading India Mind League…" />
            </div>
            <div class="f">
              <label>Loading image</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'loadingImageUrl' }" />
            </div>
          </div>
          <div class="hint">Shown briefly while the site loads. If both are blank, no loading screen is shown.</div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Homepage — "Who Can Participate?" Card</h3>
          <div class="f">
            <label>Title</label>
            <input [(ngModel)]="form['participateTitle']" placeholder="Who Can Participate?" />
          </div>
          <div class="f">
            <label>Intro text</label>
            <input [(ngModel)]="form['participateIntro']" placeholder="Curious, ambitious and creative students ready to challenge themselves:" />
          </div>
          <div class="f">
            <label>Bullet points</label>
            <textarea [(ngModel)]="form['participateBullets']" rows="4" placeholder="One point per line"></textarea>
            <div class="hint">One point per line — each becomes a checkmarked line on the homepage.</div>
          </div>
          <div class="f-row">
            <div class="f">
              <label>Button text</label>
              <input [(ngModel)]="form['participateBtnText']" placeholder="Eligibility Details →" />
            </div>
            <div class="f">
              <label>Button link</label>
              <input [(ngModel)]="form['participateBtnLink']" placeholder="/terms" />
              <div class="hint">A path starting with "/" navigates within the site; anything else opens as an external link.</div>
            </div>
          </div>
          <div class="f">
            <label>Photo</label>
            <ng-container *ngTemplateOutlet="picker; context: { field: 'participatePhotoUrl' }" />
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Homepage — "Why Join IML?" Card</h3>
          <div class="f">
            <label>Title</label>
            <input [(ngModel)]="form['whyJoinTitle']" placeholder="Why Join IML?" />
          </div>
          <div class="f">
            <label>Bullet points</label>
            <textarea [(ngModel)]="form['whyJoinBullets']" rows="4" placeholder="One point per line"></textarea>
            <div class="hint">One point per line — each becomes a checkmarked line on the homepage.</div>
          </div>
          <div class="f-row">
            <div class="f">
              <label>Button text</label>
              <input [(ngModel)]="form['whyJoinBtnText']" placeholder="Explore More →" />
            </div>
            <div class="f">
              <label>Button link</label>
              <input [(ngModel)]="form['whyJoinBtnLink']" placeholder="/#why" />
              <div class="hint">A path starting with "/" navigates within the site; anything else opens as an external link.</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Homepage — "Watch IML in Action" Video Card</h3>
          <div class="f-row">
            <div class="f">
              <label>Video URL</label>
              <input [(ngModel)]="form['videoUrl']" placeholder="videos/school_campus.mp4" />
              <div class="hint">An .mp4 file — upload one under Uploads and paste its URL, or link an external video file.</div>
            </div>
            <div class="f">
              <label>Caption</label>
              <input [(ngModel)]="form['videoCaption']" placeholder="Watch IML in Action" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Certificate Template</h3>
          <p class="hint" style="margin:-0.4rem 0 0.9rem;">
            The certificate's layout is fixed; the background, logos, badge and signatures below can be
            replaced. Leave any of these blank to use the bundled default.
          </p>
          <div class="f" style="background:rgba(232,182,74,0.06);border:1px solid rgba(232,182,74,0.25);border-radius:10px;padding:0.9rem 1rem;margin-bottom:1rem;">
            <label>Preview a certificate</label>
            <div class="f-row" style="align-items:center;">
              <button type="button" class="btn btn-sm btn-gold" [disabled]="downloadingSample()" (click)="downloadSample()">
                {{ downloadingSample() ? 'Rendering…' : 'Download Sample Certificate' }}
              </button>
              <span class="hint" style="margin:0;">No real certificate needed — uses placeholder sample data.</span>
            </div>
            <div class="hint" style="margin-top:0.7rem;">
              Both options render right now with whatever is saved below (save changes first) — the fastest
              way to check a new signature, logo or background.
            </div>
            <div class="f-row" style="align-items:flex-end; margin-top:0.6rem;">
              <div class="f">
                <label>Or check a real, already-issued certificate</label>
                <input [(ngModel)]="previewCertNumber" placeholder="e.g. IML-AMT-2026-000001" />
              </div>
              <button type="button" class="btn btn-sm" [disabled]="downloadingPreview() || !previewCertNumber" (click)="downloadPreview()">
                {{ downloadingPreview() ? 'Rendering…' : 'Download PDF' }}
              </button>
            </div>
            @if (previewError() || sampleError()) {
              <div class="err" style="margin-top:0.5rem;">{{ previewError() || sampleError() }}</div>
            }
          </div>
          <div class="f">
            <label>Background</label>
            <ng-container *ngTemplateOutlet="picker; context: { field: 'certBackgroundUrl' }" />
            <div class="hint">
              ⚠️ Every text position on the certificate was measured against the bundled background's exact
              corner artwork and frame. A replacement with a different shape or layout isn't re-checked
              against those positions — text could overlap it. Preview a test certificate after changing this.
            </div>
          </div>
          <div class="f-row">
            <div class="f">
              <label>IML logo (watermark)</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'certImlLogoUrl' }" />
            </div>
            <div class="f">
              <label>Amity Group of Schools logo</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'certAmityLogoUrl' }" />
            </div>
          </div>
          <div class="f">
            <label>Badge / seal</label>
            <ng-container *ngTemplateOutlet="picker; context: { field: 'certBadgeUrl' }" />
          </div>
          <div class="f">
            <label>Body text</label>
            <textarea
              [(ngModel)]="form['certDescriptionTemplate']"
              rows="4"
              placeholder="For active participation of {{ '{' }}schoolName{{ '}' }} in the {{ '{' }}eventNameBold{{ '}' }}. Your effort, curiosity and determination reflect strong Intellectual, Emotional, Social and Leadership Intelligence — keep inspiring and achieving!"
            ></textarea>
            <div class="hint">
              Use <code>{{ '{' }}schoolName{{ '}' }}</code> and <code>{{ '{' }}studentName{{ '}' }}</code> for
              per-student text, and <code>{{ '{' }}eventNameBold{{ '}' }}</code> for the bold green "India Mind
              League &lt;event&gt;" phrase — that one always renders in bold, no HTML tags are ever accepted here.
              Leave blank to use the default above.
            </div>
          </div>

          <h3 style="margin:1.4rem 0 0.9rem;">Signatures</h3>
          <p class="hint" style="margin:-0.4rem 0 0.9rem;">
            Until a signature image is uploaded, the certificate reserves the space with an empty placeholder —
            it never fabricates or hides a signature.
          </p>
          <div class="f-row">
            <div class="f">
              <label>Left signature image</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'certSigLeftImageUrl' }" />
            </div>
            <div class="f">
              <label>Right signature image</label>
              <ng-container *ngTemplateOutlet="picker; context: { field: 'certSigRightImageUrl' }" />
            </div>
          </div>
          <div class="f-row">
            <div class="f">
              <label>Left name</label>
              <input [(ngModel)]="form['certSigLeftName']" placeholder="Program Director" />
            </div>
            <div class="f">
              <label>Left role</label>
              <input [(ngModel)]="form['certSigLeftRole']" placeholder="India Mind League" />
            </div>
          </div>
          <div class="f-row">
            <div class="f">
              <label>Right name</label>
              <input [(ngModel)]="form['certSigRightName']" placeholder="Registrar" />
            </div>
            <div class="f">
              <label>Right role</label>
              <input [(ngModel)]="form['certSigRightRole']" placeholder="Amity Group of Schools" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Registration</h3>
          <p class="hint" style="margin:-0.4rem 0 0.9rem;">
            Which competition a plain <code>/register</code> visit signs the student up for — one that
            didn't arrive via a specific competition's own "Register" link (those always carry their own
            <code>?comp=CODE</code> and ignore this setting). Leave unset to fall back to whichever
            competition is currently Live.
          </p>
          <div class="f">
            <label>Default competition</label>
            <select [(ngModel)]="form['defaultCompetitionCode']">
              <option value="">— Fall back to the current Live competition —</option>
              @for (c of competitions(); track c.code) {
                <option [value]="c.code">{{ c.title }} ({{ c.code }})</option>
              }
            </select>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Default Demo Exam</h3>
          <p class="hint" style="margin:-0.4rem 0 0.9rem;">
            Always-available "see how the test works" sample — shown once to every new registrant on
            their dashboard, and always reachable from a permanent "Try the Demo" link. Its questions
            come only from the Question Bank rows flagged "Demo question" there — never a real exam's
            pool.
          </p>
          <div class="f">
            <label><input type="checkbox" [ngModel]="demoExamActive()" (ngModelChange)="demoExamActive.set($event)" style="width:auto;margin-right:0.5rem;" />Demo exam enabled</label>
            <div class="hint">Turn off to hide the "Try the Demo" prompt and link everywhere until you're ready.</div>
          </div>
          <div class="f">
            <label>Title</label>
            <input [(ngModel)]="form['demoExamTitle']" placeholder="Try a Sample Test" />
          </div>
          <div class="f-row">
            <div class="f">
              <label>Duration (min)</label>
              <input type="number" min="1" [(ngModel)]="form['demoExamDurationMin']" placeholder="10" />
            </div>
            <div class="f">
              <label>Questions shown</label>
              <input type="number" min="1" [(ngModel)]="form['demoExamQuestionCount']" placeholder="Leave blank for all demo questions" />
              <div class="hint">Randomly drawn from every "Demo question" in the Question Bank each time.</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Results Page Settings</h3>
          <div class="f">
            <label>
              <input type="checkbox" [ngModel]="showQuestionHistory()" (ngModelChange)="showQuestionHistory.set($event)" style="width:auto;margin-right:0.5rem;" />
              Show question-wise exam history to students
            </label>
            <div class="hint">
              On: a student's result page shows every question they were asked, their answer, and the
              correct one. Off: only the overall result (score, rank, etc.) shows — no question-wise
              detail, enforced on the server, not just hidden on the page.
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Reusable picker row: thumbnail + current filename + Choose/Clear buttons -->
    <ng-template #picker let-field="field">
      <div class="img-pick">
        @if (form[field]) {
          <img [src]="form[field]" alt="" class="img-pick-thumb" />
        } @else {
          <div class="img-pick-thumb empty-thumb">—</div>
        }
        <div class="img-pick-body">
          <span class="img-pick-name">{{ fileName(form[field]) || 'Not set' }}</span>
          <div class="img-pick-actions">
            <button type="button" class="btn btn-sm" (click)="openLibrary(field)">Choose Image</button>
            @if (form[field]) {
              <button type="button" class="btn btn-sm btn-danger" (click)="form[field] = ''">Clear</button>
            }
          </div>
        </div>
      </div>
    </ng-template>

    @if (libraryField()) {
      <app-media-library-modal
        folder="site-settings"
        (selected)="onImageSelected($event)"
        (close)="libraryField.set(null)"
      />
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminSettingsPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly libraryField = signal<ImageField | null>(null);
  protected readonly downloadingPreview = signal(false);
  protected readonly previewError = signal('');
  protected readonly downloadingSample = signal(false);
  protected readonly sampleError = signal('');
  protected previewCertNumber = '';

  // Indexed with a dynamic field name inside the *ngTemplateOutlet picker,
  // so this stays a plain string-keyed record rather than Record<keyof SiteSetting, ...>.
  protected form: Record<string, string> = {
    logoLightUrl: '',
    logoDarkUrl: '',
    logoMobileUrl: '',
    faviconUrl: '',
    contactEmail: '',
    contactPhone: '',
    officeAddress: '',
    googleMapsUrl: '',
    registrationDeadline: '',
    gaScript: '',
    analyticsEmbedUrl: '',
    loadingText: '',
    loadingImageUrl: '',
    participateTitle: '',
    participateIntro: '',
    participateBullets: '',
    participateBtnText: '',
    participateBtnLink: '',
    participatePhotoUrl: '',
    whyJoinTitle: '',
    whyJoinBullets: '',
    whyJoinBtnText: '',
    whyJoinBtnLink: '',
    videoUrl: '',
    videoCaption: '',
    certBackgroundUrl: '',
    certImlLogoUrl: '',
    certAmityLogoUrl: '',
    certBadgeUrl: '',
    certSigLeftImageUrl: '',
    certSigLeftName: '',
    certSigLeftRole: '',
    certSigRightImageUrl: '',
    certSigRightName: '',
    certSigRightRole: '',
    certDescriptionTemplate: '',
    demoExamTitle: '',
    demoExamDurationMin: '',
    demoExamQuestionCount: '',
    defaultCompetitionCode: '',
  };
  // Boolean and numeric demo-exam fields live outside the generic
  // string-keyed `form` above (same reason registrationDeadline gets its
  // own conversion in save() — the API expects real types, not strings).
  protected readonly demoExamActive = signal(true);
  protected readonly showQuestionHistory = signal(true);

  // Every competition regardless of status, so a default can be lined up
  // before it actually goes Live — same `?limit=100` convention other
  // admin pages already use for a plain, non-paginated dropdown source
  // (see AdminResultsPage/AdminLeaderboardPage).
  protected readonly competitions = signal<{ code: string; title: string }[]>([]);

  ngOnInit(): void {
    this.api.get<SiteSetting>('/settings').subscribe({
      next: (s) => {
        for (const key of Object.keys(this.form) as (keyof SiteSetting)[]) {
          if (key === 'registrationDeadline') {
            this.form[key] = this.toLocalInputValue(s[key] as string | null);
          } else {
            this.form[key] = s[key] != null ? String(s[key]) : '';
          }
        }
        this.demoExamActive.set(s.demoExamActive);
        this.showQuestionHistory.set(s.showQuestionHistory);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
    this.api.get<{ data: { code: string; title: string }[] }>('/competitions', { limit: 100 }).subscribe({
      next: (r) => this.competitions.set(r.data ?? []),
      error: () => this.competitions.set([]),
    });
  }

  /** ISO string from the API -> the "YYYY-MM-DDTHH:mm" format a datetime-local input needs, in the browser's local time. */
  private toLocalInputValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  protected openLibrary(field: ImageField): void {
    this.libraryField.set(field);
  }

  protected onImageSelected(url: string): void {
    const field = this.libraryField();
    if (field) this.form[field] = url;
    this.libraryField.set(null);
  }

  protected fileName(url: string): string {
    if (!url) return '';
    const clean = url.split('?')[0];
    return clean.split('/').pop() ?? clean;
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    // Convert the datetime-local value (no time zone) to a real ISO instant
    // in the browser's local time zone, so it means the same moment no
    // matter what time zone the server happens to run in.
    const payload: Record<string, unknown> = { ...this.form };
    if (payload['registrationDeadline']) {
      const d = new Date(payload['registrationDeadline'] as string);
      payload['registrationDeadline'] = Number.isNaN(d.getTime()) ? '' : d.toISOString();
    }
    // Real types, not strings — see the `form` comment above.
    payload['demoExamActive'] = this.demoExamActive();
    payload['showQuestionHistory'] = this.showQuestionHistory();
    payload['demoExamDurationMin'] = this.form['demoExamDurationMin']
      ? Number(this.form['demoExamDurationMin'])
      : undefined;
    payload['demoExamQuestionCount'] = this.form['demoExamQuestionCount']
      ? Number(this.form['demoExamQuestionCount'])
      : null;
    this.api.patch<SiteSetting>('/settings', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast('Settings saved');
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errText(e));
      },
    });
  }

  /** Re-renders an already-issued certificate live (see the admin-only
   * GET /certificates/:certificateNumber/download endpoint) and saves it
   * straight to disk via the browser — the fastest way to check a
   * signature/logo/background change without a script or a redeploy. */
  downloadPreview(): void {
    const number = this.previewCertNumber.trim();
    if (this.downloadingPreview() || !number) return;
    this.downloadingPreview.set(true);
    this.previewError.set('');

    this.api.downloadBlob(`/certificates/${encodeURIComponent(number)}/download`).subscribe({
      next: (blob) => {
        this.downloadingPreview.set(false);
        this.triggerDownload(blob, `${number}.pdf`);
      },
      error: async (e: HttpErrorResponse) => {
        this.downloadingPreview.set(false);
        this.previewError.set(await this.blobErrorText(e));
      },
    });
  }

  /** Same idea as downloadPreview(), but for GET /certificates/sample/download
   * — no real registration or Certificate row needed, just fixed sample
   * data rendered with whatever's currently saved below. The quickest way
   * to sanity-check a change without first having to issue a real
   * certificate and remember its number. */
  downloadSample(): void {
    if (this.downloadingSample()) return;
    this.downloadingSample.set(true);
    this.sampleError.set('');

    this.api.downloadBlob('/certificates/sample/download').subscribe({
      next: (blob) => {
        this.downloadingSample.set(false);
        this.triggerDownload(blob, 'sample-certificate.pdf');
      },
      error: async (e: HttpErrorResponse) => {
        this.downloadingSample.set(false);
        this.sampleError.set(await this.blobErrorText(e));
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** With responseType:'blob', a failed request's error body is ALSO a
   * Blob, not parsed JSON — errText() alone can't read the real message
   * out of it, so unwrap it here first. */
  private async blobErrorText(e: HttpErrorResponse): Promise<string> {
    if (e.error instanceof Blob) {
      try {
        const parsed = JSON.parse(await e.error.text());
        return parsed.message ?? 'Could not render this certificate.';
      } catch {
        return 'Could not render this certificate.';
      }
    }
    return errText(e);
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => {
      if (this.toast() === msg) this.toast.set('');
    }, 2200);
  }
}

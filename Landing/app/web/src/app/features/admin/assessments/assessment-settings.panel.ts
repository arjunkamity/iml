import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  AdminAssessment,
  AdminCategory,
  AssessmentCapacityDef,
  AssessmentsAdminApi,
  errText,
} from './assessments-admin.service';

@Component({
  selector: 'app-assessment-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }
    @if (saved()) {
      <div class="ok-note">Saved.</div>
    }

    <div class="card" style="margin-bottom:1.1rem">
      <h3>Details</h3>
      <div class="f-row">
        <div class="f">
          <label for="as-title">Title</label>
          <input id="as-title" type="text" [(ngModel)]="title" maxlength="190" />
        </div>
        <div class="f">
          <label for="as-cat">Category</label>
          <select id="as-cat" [(ngModel)]="categoryId">
            <option [ngValue]="null">Uncategorised</option>
            @for (c of categories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
      </div>
      <div class="f-row">
        <div class="f">
          <label for="as-grades">Grades that can take it</label>
          <input id="as-grades" type="text" [(ngModel)]="grades" placeholder="e.g. 9,10,11,12 or 9-12 (blank = every grade)" />
        </div>
        <div class="f">
          <label>Student link</label>
          <input type="text" [value]="studentUrl()" readonly (focus)="selectAll($event)" />
        </div>
      </div>
      <div class="f full">
        <label for="as-sum">Short description <small>(shown on the student's assessment list and start page)</small></label>
        <textarea id="as-sum" [(ngModel)]="summary"></textarea>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.1rem">
      <h3>Wording students see</h3>
      <div class="f full">
        <label for="as-consent">Consent note <small>(shown before the first question; leave blank to show none)</small></label>
        <textarea id="as-consent" [(ngModel)]="consent"></textarea>
      </div>
      <div class="f full">
        <label for="as-disc">Disclaimer <small>(start page and result page)</small></label>
        <textarea id="as-disc" [(ngModel)]="disclaimer"></textarea>
      </div>
      <div class="f full">
        <label for="as-how">"How is this scored?" text <small>(result page)</small></label>
        <textarea id="as-how" [(ngModel)]="howScored"></textarea>
      </div>
    </div>

    <div class="card">
      <div class="bar" style="margin-bottom:0.4rem">
        <h3 style="margin:0">Capacities and score bands</h3>
        <div class="grow"></div>
        @if (!a().locked) {
          <button class="btn btn-sm" (click)="addCapacity()">+ Add capacity</button>
        }
      </div>
      <p class="hint" style="margin-top:0">
        A capacity is one thing the assessment measures (for example Think or Lead). Each question belongs to one capacity, and a
        student's points for it are turned into a band. The key is what questions and CSV uploads refer to.
      </p>
      @if (a().locked) {
        <div class="lock-note">Students have already completed this assessment, so capacities and bands are locked. Use "Make a new version" to change them.</div>
      }
      @for (d of dims(); track $index; let i = $index) {
        <fieldset class="cap" [disabled]="a().locked">
          <div class="f-row">
            <div class="f">
              <label>Key</label>
              <input type="text" [ngModel]="d.key" (ngModelChange)="setKey(d, $event)" maxlength="20" placeholder="THINK" />
            </div>
            <div class="f">
              <label>Label</label>
              <input type="text" [(ngModel)]="d.label" maxlength="60" placeholder="Think" />
            </div>
          </div>
          <div class="f full">
            <label>What this capacity means <small>(student start page)</small></label>
            <textarea [(ngModel)]="d.intro"></textarea>
          </div>
          <div class="f full">
            <label>7-day practice <small>(shown for the student's lowest capacity)</small></label>
            <textarea [(ngModel)]="d.practice"></textarea>
          </div>
          <div class="sec">Score bands</div>
          @for (b of d.bands; track $index; let j = $index) {
            <div class="band">
              <input type="text" [(ngModel)]="b.label" placeholder="Band name" aria-label="Band name" />
              <input class="num" type="number" [(ngModel)]="b.min" aria-label="From score" /> <span>to</span>
              <input class="num" type="number" [(ngModel)]="b.max" aria-label="To score" />
              <button class="opt-remove" [disabled]="d.bands.length <= 1" (click)="removeBand(d, j)" aria-label="Remove band">✕</button>
              <input class="wide" type="text" [(ngModel)]="b.summary" placeholder="What this band says to the student" aria-label="Band summary" />
            </div>
          }
          <div class="cap-actions">
            <button class="btn btn-sm" (click)="addBand(d)">+ Add band</button>
            <button class="btn btn-sm btn-danger" [disabled]="dims().length <= 1" (click)="removeCapacity(i)">Remove capacity</button>
          </div>
        </fieldset>
      }
    </div>

    <div class="bar" style="margin-top:1rem">
      <button class="btn btn-gold" [disabled]="busy()" (click)="save()">{{ busy() ? 'Saving…' : 'Save changes' }}</button>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .ok-note { background: rgba(52, 211, 153, 0.14); border: 1px solid rgba(52, 211, 153, 0.4); color: #86efac; padding: 0.55rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin-bottom: 1rem; }
      .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin: 0.4rem 0 0.9rem; }
      fieldset.cap { border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 14px; padding: 1rem 1rem 0.6rem; margin: 0 0 1rem; min-width: 0; background: rgba(0, 0, 0, 0.14); }
      fieldset.cap:disabled { opacity: 0.8; }
      .band { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.7rem; }
      .band input { padding: 0.5rem 0.7rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .band input[type='text']:first-child { flex: 1 1 140px; min-width: 0; }
      .band input.num { width: 72px; flex: 0 0 auto; }
      .band input.wide { flex: 1 1 100%; min-width: 0; }
      .cap-actions { display: flex; gap: 0.5rem; margin: 0.4rem 0 0.6rem; }
    `,
  ],
})
export class AssessmentSettingsPanel {
  private readonly api = inject(AssessmentsAdminApi);

  readonly a = input.required<AdminAssessment>();
  readonly changed = output<AdminAssessment>();

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly dims = signal<AssessmentCapacityDef[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);

  protected title = '';
  protected summary = '';
  protected grades = '';
  protected categoryId: number | null = null;
  protected consent = '';
  protected disclaimer = '';
  protected howScored = '';

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    // Re-seed the form whenever the saved assessment changes (first load, and after each save).
    effect(() => {
      const a = this.a();
      this.title = a.title;
      this.summary = a.summary ?? '';
      this.grades = a.grades ?? '';
      this.categoryId = a.categoryId;
      this.consent = a.consent;
      this.disclaimer = a.disclaimer;
      this.howScored = a.howScored;
      this.dims.set(structuredClone(a.dimensions) as AssessmentCapacityDef[]);
    });
  }

  protected studentUrl(): string {
    return `${window.location.origin}${this.a().studentPath}`;
  }

  protected selectAll(ev: Event): void {
    (ev.target as HTMLInputElement).select();
  }

  protected setKey(d: AssessmentCapacityDef, raw: string): void {
    d.key = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20);
  }

  protected addCapacity(): void {
    this.dims.update((x) => [
      ...x,
      { key: '', label: '', intro: '', practice: '', bands: [{ label: 'Developing', min: 0, max: 0, summary: '' }] },
    ]);
  }

  protected removeCapacity(i: number): void {
    if (!confirm('Remove this capacity? Questions tagged with it will need to be moved to another capacity before you can publish.')) return;
    this.dims.update((x) => x.filter((_, idx) => idx !== i));
  }

  protected addBand(d: AssessmentCapacityDef): void {
    const last = d.bands[d.bands.length - 1];
    d.bands = [...d.bands, { label: '', min: (last?.max ?? -1) + 1, max: (last?.max ?? -1) + 1, summary: '' }];
  }

  protected removeBand(d: AssessmentCapacityDef, j: number): void {
    d.bands = d.bands.filter((_, idx) => idx !== j);
  }

  protected save(): void {
    this.error.set('');
    this.saved.set(false);
    this.busy.set(true);
    const body: Record<string, unknown> = {
      title: this.title.trim(),
      summary: this.summary,
      grades: this.grades,
      categoryId: this.categoryId,
      consent: this.consent,
      disclaimer: this.disclaimer,
      howScored: this.howScored,
    };
    // Sending capacities for a locked assessment is rejected by the server, and nothing changed anyway.
    if (!this.a().locked) {
      body['dimensions'] = this.dims().map((d) => ({
        ...d,
        bands: d.bands.map((b) => ({ ...b, min: Number(b.min), max: Number(b.max) })),
      }));
    }
    this.api.update(this.a().code, body).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.saved.set(true);
        this.changed.emit(r);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }
}

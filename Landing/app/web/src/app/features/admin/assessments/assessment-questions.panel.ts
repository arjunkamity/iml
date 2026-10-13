import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  AdminAssessment,
  AdminAssessmentQuestion,
  AssessmentsAdminApi,
  BulkResult,
  PreviewResult,
  errText,
} from './assessments-admin.service';

interface OptionDraft {
  text: string;
  points: number;
}

interface QuestionDraft {
  code: string | null;
  capacity: string;
  prompt: string;
  options: OptionDraft[];
}

@Component({
  selector: 'app-assessment-questions',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (a().locked) {
      <div class="lock-note">
        Students have already completed this assessment, so its questions are locked — editing them would change what existing results mean.
        Use "Make a new version" at the top to publish a corrected copy.
      </div>
    }
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="bar">
      <select class="filter" [ngModel]="capacityFilter()" (ngModelChange)="capacityFilter.set($event)" aria-label="Filter by capacity">
        <option value="">All capacities</option>
        @for (d of a().dimensions; track d.key) {
          <option [value]="d.key">{{ d.label || d.key }}</option>
        }
      </select>
      <span class="muted">{{ shown().length }} of {{ questions().length }} questions</span>
      <div class="grow"></div>
      <button class="btn" [disabled]="!questions().length" (click)="openTry()">Try it</button>
      <button class="btn" [disabled]="a().locked" (click)="openBulk()">Bulk upload</button>
      <button class="btn btn-gold" [disabled]="a().locked" (click)="openEditor(null)">+ Add question</button>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!shown().length) {
      <div class="card empty">
        @if (questions().length) {
          No questions for that capacity.
        } @else {
          No questions yet. Add them one at a time, or use Bulk upload with a CSV.
        }
      </div>
    } @else {
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Capacity</th><th>Scenario</th><th>Options (points)</th><th></th></tr>
          </thead>
          <tbody>
            @for (q of shown(); track q.code; let i = $index) {
              <tr>
                <td data-label="#">{{ q.code }}</td>
                <td data-label="Capacity"><span class="bdg blue">{{ q.capacity }}</span></td>
                <td data-label="Scenario" class="prompt-cell">{{ q.prompt }}</td>
                <td data-label="Options (points)">
                  <span class="pts">
                    @for (p of q.points; track $index) {
                      <i [title]="q.options[$index]">{{ p }}</i>
                    }
                  </span>
                </td>
                <td>
                  <div class="acts">
                    <button class="btn btn-sm" [disabled]="a().locked" (click)="openEditor(q)">Edit</button>
                    <button class="btn btn-sm btn-danger" [disabled]="a().locked" (click)="remove(q)">Delete</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (draft(); as d) {
      <div class="modal-root" (click)="draft.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ d.code ? 'Edit ' + d.code : 'Add a question' }}</h3><button class="m-x" (click)="draft.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) {
              <div class="err">{{ modalError() }}</div>
            }
            <div class="f">
              <label for="aq-cap">Capacity</label>
              <select id="aq-cap" [(ngModel)]="d.capacity">
                @for (c of a().dimensions; track c.key) {
                  <option [value]="c.key">{{ c.label || c.key }} ({{ c.key }})</option>
                }
              </select>
            </div>
            <div class="f">
              <label for="aq-prompt">Scenario</label>
              <textarea id="aq-prompt" [(ngModel)]="d.prompt" placeholder="Describe the situation the student has to respond to"></textarea>
            </div>
            <div class="sec" style="margin-top:0.4rem">Options and the points each one scores</div>
            <p class="hint" style="margin-top:0">There is no right answer: a student's chosen option adds its points to the capacity's total. List options in any order — students see them shuffled.</p>
            <div class="opt-builder">
              @for (o of d.options; track $index; let i = $index) {
                <div class="opt-row">
                  <span class="key">{{ letter(i) }}</span>
                  <input type="text" [(ngModel)]="o.text" placeholder="Option text" [attr.aria-label]="'Option ' + letter(i)" />
                  <input class="pt" type="number" min="0" max="10" [(ngModel)]="o.points" [attr.aria-label]="'Points for option ' + letter(i)" title="Points (0–10)" />
                  <button class="opt-remove" [disabled]="d.options.length <= 2" (click)="removeOption(d, i)" aria-label="Remove option">✕</button>
                </div>
              }
            </div>
            <button class="btn btn-sm" style="margin-top:0.6rem" [disabled]="d.options.length >= 6" (click)="addOption(d)">+ Add option</button>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="draft.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="saveQuestion()">{{ busy() ? 'Saving…' : 'Save question' }}</button>
          </div>
        </div>
      </div>
    }

    @if (bulkOpen()) {
      <div class="modal-root" (click)="bulkOpen.set(false)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Bulk upload questions</h3><button class="m-x" (click)="bulkOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            <p class="hint" style="margin-top:0">
              One question per row with the columns <b>capacity</b>, <b>scenario</b>, <b>option_1…option_6</b> and <b>points_1…points_6</b>.
              The capacity must be one of: {{ capacityKeys() }}. Check the file first — nothing is saved until you import.
            </p>
            <button class="btn btn-sm" (click)="sample()">Download sample CSV</button>
            <div class="f" style="margin-top:1rem">
              <label for="aq-file">CSV file</label>
              <input id="aq-file" type="file" accept=".csv,text/csv" (change)="onFile($event)" />
            </div>
            @if (bulkError()) {
              <div class="err">{{ bulkError() }}</div>
            }
            @if (bulk(); as r) {
              <div class="bulk-summary">
                <span class="bdg blue">{{ r.total }} rows</span>
                <span class="bdg green">{{ r.created }} {{ r.dryRun ? 'ready to import' : 'imported' }}</span>
                <span class="bdg" [class.red]="r.failed" [class.grey]="!r.failed">{{ r.failed }} with problems</span>
              </div>
              @if (r.errors.length) {
                <div class="bulk-errors-wrap">
                  <table class="mini">
                    <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                    <tbody>
                      @for (e of r.errors; track $index) {
                        <tr><td>{{ e.row }}</td><td>{{ e.message }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="bulkOpen.set(false)">{{ bulk() && !bulk()!.dryRun ? 'Done' : 'Cancel' }}</button>
            <button class="btn" [disabled]="!file || busy()" (click)="runBulk(true)">Check file</button>
            <button class="btn btn-gold" [disabled]="!canImport() || busy()" (click)="runBulk(false)">Import {{ bulk()?.created || '' }} question(s)</button>
          </div>
        </div>
      </div>
    }

    @if (tryOpen()) {
      <div class="modal-root" (click)="tryOpen.set(false)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Try it — nothing is saved</h3><button class="m-x" (click)="tryOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            <p class="hint" style="margin-top:0">Pick an option for every scenario to see exactly the scores and bands a student would get.</p>
            @if (tryError()) {
              <div class="err">{{ tryError() }}</div>
            }
            @if (tryResult(); as r) {
              <div class="try-result">
                @for (d of r.dimensions; track d.key) {
                  <div class="try-dim">
                    <b>{{ d.label }}</b>
                    <span class="big">{{ d.score }}<small> / {{ d.max }}</small></span>
                    <span class="bdg gold">{{ d.band || 'no band covers this score' }}</span>
                    <small>{{ d.summary }}</small>
                  </div>
                }
              </div>
            }
            @for (q of questions(); track q.code; let n = $index) {
              <fieldset class="try-q">
                <legend>{{ n + 1 }}. <span class="bdg blue">{{ q.capacity }}</span> {{ q.prompt }}</legend>
                @for (o of q.options; track $index; let i = $index) {
                  <label class="try-opt" [class.on]="picks()[q.id] === i">
                    <input type="radio" [name]="'try' + q.id" [checked]="picks()[q.id] === i" (change)="pick(q.id, i)" />
                    <span>{{ o }}</span>
                    <i>{{ q.points[i] }} pt</i>
                  </label>
                }
              </fieldset>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="tryOpen.set(false)">Close</button>
            <button class="btn" (click)="autoPick('high')">Fill highest</button>
            <button class="btn" (click)="autoPick('low')">Fill lowest</button>
            <button class="btn btn-gold" [disabled]="busy() || !allPicked()" (click)="score()">Score it</button>
          </div>
        </div>
      </div>
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .muted { color: var(--faint, #6e7f9e); font-size: 0.85rem; }
      .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin-bottom: 1rem; }
      .prompt-cell { max-width: 520px; }
      .pts { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.25rem; }
      .pts i { font-style: normal; font-weight: 800; font-size: 0.78rem; min-width: 1.5rem; text-align: center; padding: 0.1rem 0.35rem; border-radius: 6px; background: rgba(255,255,255,0.07); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); }
      .opt-row input.pt { flex: 0 0 72px; width: 72px; margin: 0; padding: 0.55rem 0.5rem; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .opt-row input[type='text'] { padding: 0.55rem 0.8rem; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      input[type='file'] { width: 100%; }
      .try-q { border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 12px; padding: 0.7rem 0.9rem 0.4rem; margin: 0 0 0.8rem; min-width: 0; }
      .try-q legend { font-weight: 700; font-size: 0.9rem; padding: 0 0.3rem; max-width: 100%; }
      .try-opt { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.5rem 0.6rem; margin-bottom: 0.4rem; border-radius: 9px; border: 1px solid var(--line, rgba(255,255,255,0.09)); cursor: pointer; font-size: 0.88rem; }
      .try-opt.on { border-color: var(--gold, #e8b64a); background: rgba(232, 182, 74, 0.1); }
      .try-opt input { width: auto; flex: 0 0 auto; margin-top: 0.2rem; accent-color: var(--gold, #e8b64a); }
      .try-opt span { flex: 1; min-width: 0; }
      .try-opt i { font-style: normal; color: var(--faint, #6e7f9e); font-size: 0.75rem; flex: 0 0 auto; }
      .try-result { display: grid; gap: 0.7rem; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 1rem; }
      .try-dim { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.8rem; border-radius: 12px; background: rgba(232, 182, 74, 0.07); border: 1px solid rgba(232, 182, 74, 0.3); }
      .try-dim .big { font-size: 1.6rem; font-weight: 800; }
      .try-dim .big small { font-size: 0.8rem; color: var(--faint, #6e7f9e); }
    `,
  ],
})
export class AssessmentQuestionsPanel {
  private readonly api = inject(AssessmentsAdminApi);

  readonly a = input.required<AdminAssessment>();
  readonly changed = output<void>();

  protected readonly questions = signal<AdminAssessmentQuestion[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly capacityFilter = signal('');
  protected readonly draft = signal<QuestionDraft | null>(null);

  protected readonly bulkOpen = signal(false);
  protected readonly bulk = signal<BulkResult | null>(null);
  protected readonly bulkError = signal('');
  protected file: File | null = null;

  protected readonly tryOpen = signal(false);
  protected readonly tryError = signal('');
  protected readonly tryResult = signal<PreviewResult | null>(null);
  protected readonly picks = signal<Record<number, number>>({});

  constructor() {
    effect(() => {
      // Reload when the assessment (or its question count) changes underneath us.
      this.a().code;
      this.a().questionCount;
      untracked(() => this.load());
    });
  }

  protected shown(): AdminAssessmentQuestion[] {
    const f = this.capacityFilter();
    return f ? this.questions().filter((q) => q.capacity === f) : this.questions();
  }

  protected capacityKeys(): string {
    return this.a().dimensions.map((d) => d.key).join(', ');
  }

  protected letter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  private load(): void {
    this.api.questions(this.a().code).subscribe({
      next: (q) => {
        this.questions.set(q);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2600);
  }

  // ---- add / edit
  protected openEditor(q: AdminAssessmentQuestion | null): void {
    this.modalError.set('');
    this.draft.set(
      q
        ? { code: q.code, capacity: q.capacity, prompt: q.prompt, options: q.options.map((text, i) => ({ text, points: q.points[i] ?? 0 })) }
        : {
            code: null,
            capacity: this.capacityFilter() || this.a().dimensions[0]?.key || '',
            prompt: '',
            options: [1, 2, 3, 4].map((points) => ({ text: '', points })),
          },
    );
  }

  protected addOption(d: QuestionDraft): void {
    d.options = [...d.options, { text: '', points: 0 }];
  }

  protected removeOption(d: QuestionDraft, i: number): void {
    d.options = d.options.filter((_, idx) => idx !== i);
  }

  protected saveQuestion(): void {
    const d = this.draft();
    if (!d) return;
    if (!d.prompt.trim()) return this.modalError.set('Write the scenario first.');
    if (d.options.some((o) => !o.text.trim())) return this.modalError.set('Every option needs text (remove any you do not need).');
    const body = {
      capacity: d.capacity,
      prompt: d.prompt,
      options: d.options.map((o) => o.text),
      points: d.options.map((o) => Number(o.points)),
    };
    this.busy.set(true);
    this.modalError.set('');
    const req = d.code ? this.api.updateQuestion(this.a().code, d.code, body) : this.api.createQuestion(this.a().code, body);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.draft.set(null);
        this.flash(d.code ? 'Question saved' : 'Question added');
        this.load();
        this.changed.emit();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected remove(q: AdminAssessmentQuestion): void {
    if (!confirm(`Delete question ${q.code}? This cannot be undone.`)) return;
    this.api.deleteQuestion(this.a().code, q.code).subscribe({
      next: () => {
        this.flash('Question deleted');
        this.load();
        this.changed.emit();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  // ---- bulk upload
  protected openBulk(): void {
    this.file = null;
    this.bulk.set(null);
    this.bulkError.set('');
    this.bulkOpen.set(true);
  }

  protected onFile(ev: Event): void {
    this.file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.bulk.set(null);
    this.bulkError.set('');
  }

  protected canImport(): boolean {
    const r = this.bulk();
    return !!this.file && !!r && r.dryRun && r.created > 0;
  }

  protected runBulk(dryRun: boolean): void {
    if (!this.file) return;
    if (!dryRun && !this.canImport()) return;
    if (!dryRun && this.bulk()?.failed && !confirm(`${this.bulk()!.failed} row(s) have problems and will be skipped. Import the ${this.bulk()!.created} good row(s)?`)) return;
    this.busy.set(true);
    this.bulkError.set('');
    this.api.bulkUpload(this.a().code, this.file, dryRun).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.bulk.set(r);
        if (!dryRun) {
          this.flash(`${r.created} question(s) imported`);
          this.load();
          this.changed.emit();
        }
      },
      error: (e) => {
        this.busy.set(false);
        this.bulkError.set(errText(e));
      },
    });
  }

  protected sample(): void {
    this.api.sampleCsv().subscribe({ error: (e) => this.bulkError.set(errText(e)) });
  }

  // ---- try it
  protected openTry(): void {
    this.picks.set({});
    this.tryResult.set(null);
    this.tryError.set('');
    this.tryOpen.set(true);
  }

  protected pick(qid: number, i: number): void {
    this.picks.update((p) => ({ ...p, [qid]: i }));
    this.tryResult.set(null);
  }

  protected allPicked(): boolean {
    const p = this.picks();
    return this.questions().length > 0 && this.questions().every((q) => p[q.id] !== undefined);
  }

  protected autoPick(kind: 'high' | 'low'): void {
    const p: Record<number, number> = {};
    for (const q of this.questions()) {
      const target = kind === 'high' ? Math.max(...q.points) : Math.min(...q.points);
      p[q.id] = q.points.indexOf(target);
    }
    this.picks.set(p);
    this.tryResult.set(null);
  }

  protected score(): void {
    this.busy.set(true);
    this.tryError.set('');
    const answers = this.questions().map((q) => ({ questionId: q.id, optionIndex: this.picks()[q.id] }));
    this.api.preview(this.a().code, answers).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.tryResult.set(r);
      },
      error: (e) => {
        this.busy.set(false);
        this.tryError.set(errText(e));
      },
    });
  }
}

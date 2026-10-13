import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PanelApi, RatingPage, errText } from './panel-api.service';
import { PANEL_CSS } from './panel-ui';

interface Draft {
  [code: string]: { optionIndex: number | null; comment: string };
}

@Component({
  selector: 'app-panel-rating',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="pn-wrap">
      <a class="pn-back" [routerLink]="['/panel/stages', stageId]">← Student list</a>
      @if (page(); as p) {
        <div class="head">
          <h1 class="pn-h1">{{ p.student.name }}</h1>
          <div class="pn-muted">{{ p.student.code }} · grade {{ p.student.grade }}{{ p.student.school ? ' · ' + p.student.school : '' }} · Stage {{ p.stage.position }}: {{ p.stage.name }}</div>
          <div class="pn-muted">{{ answered() }} of {{ p.form.competencies.length }} rated · {{ saveState() }}</div>
          <div class="pn-bar"><i [style.width.%]="progress()"></i></div>
        </div>

        @if (locked()) { <div class="pn-ok">This rating was submitted and is locked. Only an administrator can reopen it.</div> }
        @if (error()) { <div class="pn-err">{{ error() }}</div> }

        @for (c of p.form.competencies; track c.code) {
          <section class="pn-card comp" [class.miss]="showMissing() && draft[c.code]?.optionIndex === null">
            <h3>{{ c.label }}</h3>
            @if (c.prompt) { <p class="pn-muted" style="margin:0 0 0.6rem">{{ c.prompt }}</p> }
            <div class="opts" role="radiogroup" [attr.aria-label]="c.label">
              @for (o of c.options; track $index) {
                <label class="opt" [class.on]="draft[c.code]?.optionIndex === $index" [class.dis]="locked()">
                  <input type="radio" [name]="c.code" [value]="$index" [checked]="draft[c.code]?.optionIndex === $index" [disabled]="locked()" (change)="choose(c.code, $index)" />
                  <span><b>{{ o.label }}</b>@if (o.hint) { <small>{{ o.hint }}</small> }</span>
                </label>
              }
            </div>
            <label class="cm" [for]="'cm-' + c.code">Comment{{ p.form.requireComment ? '' : ' (optional)' }}</label>
            <textarea class="pn-text" [id]="'cm-' + c.code" rows="2" [disabled]="locked()" [ngModel]="draft[c.code]?.comment" (ngModelChange)="setComment(c.code, $event)"></textarea>
          </section>
        }

        <section class="pn-card">
          <h3>{{ p.form.noteLabel }}{{ p.form.noteRequired ? '' : ' (optional)' }}</h3>
          <textarea class="pn-text" rows="4" [disabled]="locked()" [ngModel]="note" (ngModelChange)="setNote($event)" placeholder="What did you observe? Write only what you saw."></textarea>
        </section>

        @if (!locked()) {
          <div class="bar">
            <button class="pn-btn" (click)="saveDraft()" [disabled]="busy()">Save draft</button>
            <button class="pn-btn gold" (click)="submit()" [disabled]="busy()">Submit and lock</button>
          </div>
        }
      } @else if (error()) {
        <div class="pn-err">{{ error() }}</div>
      } @else {
        <p class="pn-muted">Loading…</p>
      }
    </div>
  `,
  styles: [
    PANEL_CSS,
    `
      .head { margin-bottom: 1rem; position: sticky; top: 56px; z-index: 5; background: var(--bg, #071021); padding: 0.4rem 0 0.2rem; }
      .comp { margin-bottom: 1rem; }
      .comp.miss { border-color: rgba(251,113,133,0.7); }
      .opts { display: grid; gap: 0.5rem; }
      .opt { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.7rem 0.8rem; border-radius: 12px; border: 1px solid var(--line-2, rgba(255,255,255,0.16)); cursor: pointer; min-height: 48px; }
      .opt.on { border-color: var(--gold, #f5cc5a); background: rgba(232,182,74,0.12); }
      .opt.dis { cursor: default; opacity: 0.85; }
      .opt input { width: 1.25rem; height: 1.25rem; margin-top: 0.1rem; accent-color: var(--gold, #e8b64a); flex: none; }
      .opt small { display: block; color: var(--muted, #9fb0d0); margin-top: 0.15rem; font-size: 0.82rem; }
      .cm { display: block; margin: 0.8rem 0 0.3rem; font-size: 0.82rem; color: var(--muted, #9fb0d0); font-weight: 600; }
      .bar { display: flex; gap: 0.7rem; flex-wrap: wrap; position: sticky; bottom: 0; padding: 0.8rem 0; background: linear-gradient(180deg, transparent, var(--bg, #071021) 40%); }
    `,
  ],
})
export class PanelRatingPage implements OnInit, OnDestroy {
  private readonly api = inject(PanelApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected stageId = 0;
  private reg = 0;
  protected readonly page = signal<RatingPage | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly locked = signal(false);
  protected readonly showMissing = signal(false);
  protected readonly saveState = signal('');
  protected draft: Draft = {};
  protected note = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  ngOnInit(): void {
    this.stageId = Number(this.route.snapshot.paramMap.get('stageId'));
    this.reg = Number(this.route.snapshot.paramMap.get('reg'));
    this.api.rating(this.stageId, this.reg).subscribe({ next: (p) => this.apply(p), error: (e) => this.error.set(errText(e)) });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.dirty && !this.locked()) this.save(false, true);
  }

  private apply(p: RatingPage): void {
    this.page.set(p);
    this.locked.set(p.rating.status === 'Submitted');
    this.note = p.rating.note ?? '';
    this.draft = Object.fromEntries(p.form.competencies.map((c) => [c.code, { optionIndex: p.rating.ratings[c.code]?.optionIndex ?? null, comment: p.rating.ratings[c.code]?.comment ?? '' }]));
    this.saveState.set(p.rating.status === 'Submitted' ? 'Submitted' : p.rating.status === 'Draft' ? 'Draft saved' : 'Not started');
    this.dirty = false;
  }

  protected answered(): number {
    return Object.values(this.draft).filter((d) => d.optionIndex !== null).length;
  }

  protected progress(): number {
    const n = this.page()?.form.competencies.length ?? 0;
    return n ? Math.round((this.answered() / n) * 100) : 0;
  }

  protected choose(code: string, idx: number): void {
    this.draft[code] = { ...(this.draft[code] ?? { comment: '' }), optionIndex: idx };
    this.touched();
  }

  protected setComment(code: string, text: string): void {
    this.draft[code] = { ...(this.draft[code] ?? { optionIndex: null }), comment: text };
    this.touched();
  }

  protected setNote(text: string): void {
    this.note = text;
    this.touched();
  }

  /** Autosave a draft a moment after the last change. */
  private touched(): void {
    this.dirty = true;
    this.saveState.set('Unsaved changes');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(false, true), 1500);
  }

  private body(submit: boolean) {
    const ratings: Record<string, { optionIndex: number; comment?: string }> = {};
    for (const [code, d] of Object.entries(this.draft)) if (d.optionIndex !== null) ratings[code] = { optionIndex: d.optionIndex, ...(d.comment.trim() ? { comment: d.comment.trim() } : {}) };
    return { ratings, note: this.note, submit };
  }

  private save(submit: boolean, quiet: boolean): void {
    if (this.locked() || this.busy()) return;
    this.busy.set(true);
    if (!quiet) this.error.set('');
    this.api.saveRating(this.stageId, this.reg, this.body(submit)).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.apply(p);
        if (submit) this.router.navigate(['/panel/stages', this.stageId]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        if (submit) this.showMissing.set(true);
        this.saveState.set('Not saved');
      },
    });
  }

  protected saveDraft(): void {
    if (this.timer) clearTimeout(this.timer);
    this.save(false, false);
  }

  protected submit(): void {
    if (this.timer) clearTimeout(this.timer);
    this.showMissing.set(true);
    if (!confirm('Submit this rating? It is locked once submitted.')) return;
    this.save(true, false);
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { FormProgress, PanelApi, PanelCompetency, PanelForm, errText } from '../../panel/panel-api.service';

interface CompEditor {
  code: string | null;
  label: string;
  dimension: string;
  prompt: string;
  weight: number;
  options: { label: string; points: number; hint: string }[];
}

@Component({
  selector: 'app-admin-panel-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <a class="back" routerLink="/admin/assessments">← Assessments</a>
    @if (error()) { <div class="err">{{ error() }}</div> }

    @if (form(); as f) {
      <div class="head">
        <div class="titles">
          <div class="line">
            <span class="bdg purple">Panel</span>
            <span class="bdg" [class.green]="f.status === 'Published'" [class.gold]="f.status === 'Draft'" [class.grey]="f.status === 'Archived'">{{ f.status }}</span>
            <span class="code">{{ f.code }}</span>
          </div>
          <h2>{{ f.title }}</h2>
          <small class="code">{{ f.competencies.length }} competencies · {{ f.settings.requiredRaters }} raters per student</small>
        </div>
        <div class="actions">
          @if (f.status !== 'Published') { <button class="btn btn-gold" [disabled]="busy() || f.issues.length > 0" [title]="f.issues.join(' ')" (click)="act('publish')">Publish</button> }
          @if (f.status === 'Published') { <button class="btn" [disabled]="busy()" (click)="act('archive')">Archive</button> }
          @if (f.status === 'Archived') { <button class="btn" [disabled]="busy()" (click)="act('unarchive')">Restore</button> }
          <button class="btn" [disabled]="busy()" (click)="copy()">Make a new version</button>
          @if (!f.usedBy.length) { <button class="btn btn-danger" [disabled]="busy()" (click)="remove()">Delete</button> }
        </div>
      </div>

      @if (f.locked) {
        <div class="card note">This form is in use: a stage using it is open or has ratings, so its competencies and settings are locked. Use “Make a new version” to change a copy.</div>
      }
      @if (f.status !== 'Published' && f.issues.length) {
        <div class="card note bad"><b>Not ready to publish yet</b><ul>@for (i of f.issues; track $index) { <li>{{ i }}</li> }</ul></div>
      }

      <div class="tabs" role="tablist">
        <button class="tab" [class.on]="tab() === 'competencies'" (click)="tab.set('competencies')">Competencies ({{ f.competencies.length }})</button>
        <button class="tab" [class.on]="tab() === 'settings'" (click)="tab.set('settings')">Settings</button>
        <button class="tab" [class.on]="tab() === 'progress'" (click)="openProgress()">Ratings progress</button>
      </div>

      @switch (tab()) {
        @case ('competencies') {
          <div class="bar">
            <span class="muted">The options appear in this order for panelists, with their hints. Points must go up from the lowest option to the highest.</span>
            <div class="grow"></div>
            <button class="btn btn-gold" [disabled]="f.locked" (click)="openComp(null)">+ Add competency</button>
          </div>
          @for (c of f.competencies; track c.code) {
            <div class="card comp">
              <div class="comp-head">
                <div><b>{{ c.label }}</b> <small class="muted">{{ c.dimension }} · weight {{ c.weight }}</small></div>
                <div class="acts">
                  <button class="btn btn-sm" [disabled]="f.locked" (click)="openComp(c)">Edit</button>
                  <button class="btn btn-sm btn-danger" [disabled]="f.locked" (click)="removeComp(c)">Delete</button>
                </div>
              </div>
              @if (c.prompt) { <p class="muted" style="margin:0.2rem 0 0.5rem">{{ c.prompt }}</p> }
              <ol class="opts">@for (o of c.options; track $index) { <li><b>{{ o.label }}</b> <small>({{ o.points }} pt)</small>@if (o.hint) { <div class="hint">{{ o.hint }}</div> }</li> }</ol>
            </div>
          } @empty {
            <div class="card empty">No competencies yet. Add the first one, using the standard scale for its options.</div>
          }
        }
        @case ('settings') {
          <div class="card">
            <div class="f-row">
              <div class="f"><label for="pf-title">Title</label><input id="pf-title" type="text" [(ngModel)]="title" maxlength="190" /></div>
              <div class="f"><label for="pf-sum">Summary</label><input id="pf-sum" type="text" [(ngModel)]="summary" /></div>
            </div>
            <div class="f-row">
              <div class="f"><label for="pf-raters">Raters per student</label><input id="pf-raters" type="number" min="1" max="9" [(ngModel)]="settings.requiredRaters" [disabled]="f.locked" /></div>
              <div class="f"><label for="pf-gap">Flag a disagreement of this many levels (0 = off)</label><input id="pf-gap" type="number" min="0" max="10" [(ngModel)]="settings.disagreementGap" [disabled]="f.locked" /></div>
            </div>
            <div class="f-row">
              <div class="f"><label for="pf-note">Heading for the observer note</label><input id="pf-note" type="text" [(ngModel)]="settings.noteLabel" maxlength="60" [disabled]="f.locked" /></div>
              <div class="f">
                <label for="pf-method">How raters' scores are combined</label>
                <select id="pf-method" [(ngModel)]="settings.method" [disabled]="f.locked"><option value="mean">Mean</option><option value="trimmed">Mean without the highest and lowest (3+ raters)</option></select>
              </div>
            </div>
            <label class="chk"><input type="checkbox" [(ngModel)]="settings.requireComment" [disabled]="f.locked" /> A comment is required on every competency</label>
            <label class="chk"><input type="checkbox" [(ngModel)]="settings.noteRequired" [disabled]="f.locked" /> The observer note is required before submitting</label>
            <div class="bar" style="margin-top:1rem"><button class="btn btn-gold" [disabled]="busy()" (click)="saveSettings()">Save settings</button></div>
          </div>
        }
        @case ('progress') {
          @if (!progress().length) {
            <div class="card empty">No stage uses this form yet. Choose it in a stage's Panel setup.</div>
          } @else {
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Competition and stage</th><th>State</th><th>Fully rated</th><th>Ratings</th></tr></thead>
                <tbody>
                  @for (p of progress(); track p.competition + p.stage) {
                    <tr>
                      <td data-label="Stage"><span class="b">{{ p.competitionTitle }}</span><small>Stage {{ p.stage }}: {{ p.stageName }}</small></td>
                      <td data-label="State"><span class="bdg">{{ p.state }}</span></td>
                      <td data-label="Fully rated">{{ p.studentsFullyRated }} students (of those with ratings: {{ p.studentsWithRatings }}); {{ p.requiredRaters }} raters each</td>
                      <td data-label="Ratings">{{ p.submittedRatings }} submitted · {{ p.draftRatings }} draft</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }

    @if (comp(); as c) {
      <div class="modal-root" (click)="comp.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ c.code ? 'Edit competency' : 'Add competency' }}</h3><button class="m-x" (click)="comp.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f-row">
              <div class="f"><label for="c-label">Name</label><input id="c-label" type="text" [(ngModel)]="c.label" maxlength="60" /></div>
              <div class="f"><label for="c-dim">Dimension</label><input id="c-dim" type="text" [(ngModel)]="c.dimension" maxlength="20" placeholder="THINK, FEEL …" /></div>
              <div class="f"><label for="c-w">Weight</label><input id="c-w" type="number" step="0.5" min="0.5" [(ngModel)]="c.weight" /></div>
            </div>
            <div class="f full"><label for="c-prompt">What the panelist observes</label><textarea id="c-prompt" rows="2" [(ngModel)]="c.prompt"></textarea></div>
            <div class="sec">Rating options, lowest to highest <button class="btn btn-sm" (click)="useStandard(c)">Use the standard scale</button></div>
            @for (o of c.options; track $index) {
              <div class="opt-row">
                <input type="text" [(ngModel)]="o.label" placeholder="Label" aria-label="Option label" />
                <input type="number" [(ngModel)]="o.points" min="0" max="10" style="width:80px" aria-label="Points" />
                <input type="text" [(ngModel)]="o.hint" placeholder="What this level looks like (optional)" aria-label="Hint" class="grow" />
                <button class="btn btn-sm" (click)="c.options.splice($index, 1)" [disabled]="c.options.length <= 2" aria-label="Remove option">✕</button>
              </div>
            }
            <button class="btn btn-sm" (click)="c.options.push({ label: '', points: (c.options[c.options.length - 1]?.points ?? 0) + 1, hint: '' })">+ Add option</button>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="comp.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="saveComp(c)">{{ busy() ? 'Saving…' : 'Save competency' }}</button>
          </div>
        </div>
      </div>
    }
    @if (toast()) { <div class="toast">{{ toast() }}</div> }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .titles h2 { margin: 0.3rem 0 0.2rem; font-size: 1.5rem; }
      .line { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
      .code { color: var(--faint, #6e7f9e); font-size: 0.8rem; font-weight: 700; }
      .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .muted { color: var(--muted, #9fb0d0); font-size: 0.85rem; }
      .note { margin-bottom: 1rem; font-size: 0.9rem; }
      .note.bad { border-color: rgba(251,113,133,0.45); background: rgba(251,113,133,0.08); }
      .note ul { margin: 0.4rem 0 0 1.1rem; padding: 0; list-style: disc; }
      .tabs { display: flex; flex-wrap: wrap; width: 100%; margin-bottom: 1rem; }
      .tab { flex: 1 1 auto; }
      .comp { margin-bottom: 0.8rem; }
      .comp-head { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
      .opts { margin: 0.3rem 0 0 1.2rem; padding: 0; display: grid; gap: 0.3rem; font-size: 0.88rem; }
      .opts .hint { color: var(--muted, #9fb0d0); font-size: 0.8rem; }
      .opt-row { display: flex; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap; align-items: center; }
      .opt-row input[type='text'] { min-width: 120px; flex: 0 1 160px; }
      .opt-row .grow { flex: 1 1 220px; }
      .chk { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; margin-top: 0.5rem; }
      .chk input { width: auto; accent-color: var(--gold, #e8b64a); }
    `,
  ],
})
export class AdminPanelFormPage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly form = signal<PanelForm | null>(null);
  protected readonly progress = signal<FormProgress[]>([]);
  protected readonly comp = signal<CompEditor | null>(null);
  protected readonly tab = signal<'competencies' | 'settings' | 'progress'>('competencies');
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected title = '';
  protected summary = '';
  protected settings = { requiredRaters: 2, disagreementGap: 2, noteLabel: 'Observer note', method: 'mean' as 'mean' | 'trimmed', requireComment: false, noteRequired: false };
  private code = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      this.code = p.get('code') ?? '';
      this.load();
    });
  }

  private flash(m: string): void {
    this.toast.set(m);
    setTimeout(() => this.toast() === m && this.toast.set(''), 2600);
  }

  private load(): void {
    this.api.form(this.code).subscribe({
      next: (f) => {
        this.form.set(f);
        this.title = f.title;
        this.summary = f.summary ?? '';
        this.settings = { ...f.settings };
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected openProgress(): void {
    this.tab.set('progress');
    this.api.formProgress(this.code).subscribe({ next: (p) => this.progress.set(p), error: (e) => this.error.set(errText(e)) });
  }

  protected saveSettings(): void {
    this.busy.set(true);
    this.api.updateForm(this.code, { title: this.title.trim(), summary: this.summary, settings: this.settings }).subscribe({
      next: (f) => {
        this.busy.set(false);
        this.form.set(f);
        this.flash('Saved');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected act(action: 'publish' | 'archive' | 'unarchive'): void {
    this.busy.set(true);
    this.error.set('');
    this.api.formAction(this.code, action).subscribe({
      next: (f) => {
        this.busy.set(false);
        this.form.set(f);
        this.flash(action === 'publish' ? 'Published' : action === 'archive' ? 'Archived' : 'Restored');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected copy(): void {
    const f = this.form();
    const name = f && prompt('Name for the new version (it starts as a draft copy):', `${f.title} (copy)`);
    if (!name || name.trim().length < 3) return;
    this.api.createForm({ title: name.trim(), cloneFrom: this.code }).subscribe({
      next: (n) => this.router.navigate(['/admin/assessments/panel', n.code]),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected remove(): void {
    if (!confirm('Delete this form? This cannot be undone.')) return;
    this.api.deleteForm(this.code).subscribe({ next: () => this.router.navigate(['/admin/assessments']), error: (e) => this.error.set(errText(e)) });
  }

  // ---- competencies
  protected openComp(c: PanelCompetency | null): void {
    this.modalError.set('');
    this.comp.set(
      c
        ? { code: c.code, label: c.label, dimension: c.dimension, prompt: c.prompt, weight: c.weight, options: c.options.map((o) => ({ ...o })) }
        : { code: null, label: '', dimension: '', prompt: '', weight: 1, options: [{ label: '', points: 1, hint: '' }, { label: '', points: 2, hint: '' }] },
    );
  }

  protected useStandard(c: CompEditor): void {
    const levels = [
      { label: 'Emerging', points: 1, hint: 'Beginning to demonstrate the competency.' },
      { label: 'Developing', points: 2, hint: 'Demonstrates the competency in familiar situations but needs greater consistency.' },
      { label: 'Proficient', points: 3, hint: 'Demonstrates the competency effectively across different situations.' },
      { label: 'Advanced', points: 4, hint: 'Demonstrates maturity, adaptability and depth while applying the competency.' },
    ];
    c.options = levels;
  }

  protected saveComp(c: CompEditor): void {
    this.busy.set(true);
    this.modalError.set('');
    const body = { label: c.label, dimension: c.dimension, prompt: c.prompt, weight: Number(c.weight), options: c.options.map((o) => o.label), points: c.options.map((o) => Number(o.points)), hints: c.options.map((o) => o.hint) };
    const req = c.code ? this.api.updateCompetency(this.code, c.code, body) : this.api.addCompetency(this.code, body);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.comp.set(null);
        this.flash('Saved');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected removeComp(c: PanelCompetency): void {
    if (!confirm(`Delete "${c.label}"?`)) return;
    this.api.deleteCompetency(this.code, c.code).subscribe({ next: () => this.load(), error: (e) => this.error.set(errText(e)) });
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  AuditRow,
  FrameworkConfig,
  FrameworkDetail,
  ScorecardAdminApi,
  errText,
} from './scorecard-admin.service';
import { ConfigDiffDialog } from './config-diff.dialog';
import { FrameworkCompetenciesPanel, FrameworkDimensionsPanel, FrameworkLevelsPanel } from './framework-panels';

type Tab = 'dimensions' | 'levels' | 'competencies' | 'rules' | 'activity';

@Component({
  selector: 'app-admin-scorecard-framework',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ConfigDiffDialog, FrameworkDimensionsPanel, FrameworkLevelsPanel, FrameworkCompetenciesPanel],
  template: `
    <a class="back" routerLink="/admin/scorecard">← Scorecard setup</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (fw(); as f) {
      @if (diffOpen()) {
        <app-config-diff kind="framework" [code]="f.code" [choices]="diffChoices(f)" (closed)="diffOpen.set(false)" />
      }
      <div class="head">
        <div class="titles">
          <div class="line">
            <span class="bdg" [class.green]="f.status === 'Published'" [class.gold]="f.status === 'Draft'" [class.grey]="f.status === 'Archived'">{{ f.status }}</span>
            <span class="code">{{ f.code }} · version {{ f.version }}</span>
            @for (v of f.versions; track v.code) {
              @if (v.code !== f.code) {
                <a class="chip" [routerLink]="['/admin/scorecard', v.code]">v{{ v.version }} ({{ v.status }})</a>
              }
            }
          </div>
          <h2>{{ f.name }}</h2>
          <small class="code">
            {{ f.config.dimensions.length }} dimensions · {{ f.config.scales.length }} scale(s) · {{ f.config.competencies.length }} competencies
            @if (f.publishedAt) {
              · published {{ f.publishedAt | date: 'd MMM y' }}
            }
          </small>
        </div>
        <div class="actions">
          @if (!f.locked) {
            <button class="btn btn-gold" [disabled]="busy() || !dirty()" (click)="save()">{{ busy() ? 'Saving…' : 'Save changes' }}</button>
            <button class="btn" [disabled]="busy() || dirty() || f.issues.length > 0" [title]="dirty() ? 'Save your changes first' : f.issues.length ? 'Fix the items below first' : ''" (click)="publish()">Publish</button>
          }
          @if (f.status === 'Published') {
            <button class="btn" [disabled]="busy()" (click)="archive()">Archive</button>
          }
          @if (f.status === 'Archived') {
            <button class="btn" [disabled]="busy()" (click)="unarchive()">Restore</button>
          }
          <button class="btn" (click)="diffOpen.set(true)">Compare versions</button>
          <button class="btn" [disabled]="busy()" (click)="newVersion()">Make a new version</button>
          @if (f.status === 'Draft') {
            <button class="btn btn-danger" [disabled]="busy()" (click)="remove()">Delete</button>
          }
        </div>
      </div>

      @if (f.status === 'Draft') {
        @if (dirty()) {
          <div class="card ready off">You have unsaved changes. Save to refresh the checklist below.</div>
        } @else if (f.issues.length) {
          <div class="card ready bad">
            <b>Not ready to publish yet</b>
            <ul>
              @for (i of f.issues; track $index) {
                <li>{{ i }}</li>
              }
            </ul>
          </div>
        } @else {
          <div class="card ready good"><b>Ready to publish.</b> Once published it is locked; change it later by making a new version.</div>
        }
      } @else {
        <div class="card ready off">
          {{ f.status === 'Published' ? 'Published and locked, so reports issued with it never change.' : 'Archived — it cannot get new seasons.' }}
          @if (f.seasons.length) {
            Used by: @for (s of f.seasons; track s.code) { <b>{{ s.code }}</b> {{ s.name }}; }
          }
        </div>
      }

      @if (!f.locked) {
        <div class="card" style="margin-bottom:1rem">
          <div class="f-row">
            <div class="f"><label for="fw-name">Name</label><input id="fw-name" type="text" [(ngModel)]="name" maxlength="190" /></div>
            <div class="f"><label for="fw-notes">Notes</label><input id="fw-notes" type="text" [(ngModel)]="notes" placeholder="Anything the next editor should know" /></div>
          </div>
        </div>
      } @else if (f.notes) {
        <div class="card ready off">{{ f.notes }}</div>
      }

      <div class="tabs" role="tablist">
        <button class="tab" role="tab" [class.on]="tab() === 'dimensions'" (click)="tab.set('dimensions')">Dimensions ({{ cfg()!.dimensions.length }})</button>
        <button class="tab" role="tab" [class.on]="tab() === 'levels'" (click)="tab.set('levels')">Levels ({{ cfg()!.scales.length }})</button>
        <button class="tab" role="tab" [class.on]="tab() === 'competencies'" (click)="tab.set('competencies')">Competencies ({{ cfg()!.competencies.length }})</button>
        <button class="tab" role="tab" [class.on]="tab() === 'rules'" (click)="openRules()">Final profile rules</button>
        <button class="tab" role="tab" [class.on]="tab() === 'activity'" (click)="openActivity()">Activity</button>
      </div>

      @switch (tab()) {
        @case ('dimensions') { <app-fw-dimensions [cfg]="cfg()!" [locked]="f.locked" /> }
        @case ('levels') { <app-fw-levels [cfg]="cfg()!" [locked]="f.locked" /> }
        @case ('competencies') { <app-fw-competencies [cfg]="cfg()!" [locked]="f.locked" /> }
        @case ('rules') {
          <div class="card">
            <p class="hint">
              How the stages roll up into the final profile: stage weights, competency mapping, strengths and growth areas, leadership styles and profile lines.
              These are the approved rules for this version — once published they are locked and every report records which version it used.
            </p>
            @if (rulesError()) { <div class="err">{{ rulesError() }}</div> }
            <textarea class="rules" rows="22" spellcheck="false" aria-label="Final profile rules" [readOnly]="f.locked" [ngModel]="rulesText()" (ngModelChange)="rulesText.set($event)"></textarea>
            @if (!f.locked) {
              <div class="rules-actions">
                <button class="btn" (click)="applyRules()">Apply to this draft</button>
                <small class="code">Then use Save changes. Saving checks the rules and lists anything to fix.</small>
              </div>
            }
          </div>
        }
        @case ('activity') {
          @if (!activity().length) {
            <div class="card empty">No activity recorded yet.</div>
          } @else {
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
                <tbody>
                  @for (a of activity(); track a.id) {
                    <tr>
                      <td data-label="When">{{ a.createdAt | date: 'd MMM y, h:mm a' }}</td>
                      <td data-label="Who">{{ a.adminName || '—' }}</td>
                      <td data-label="What"><span class="bdg grey">{{ a.action }}</span></td>
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

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .back:hover { color: var(--gold-2, #f5cc5a); }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .titles { min-width: 0; flex: 1 1 320px; }
      .titles .line { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
      .titles h2 { margin: 0 0 0.25rem; font-size: 1.5rem; line-height: 1.2; text-wrap: balance; }
      .code { color: var(--faint, #6e7f9e); font-size: 0.8rem; font-weight: 700; }
      .chip { font-size: 0.74rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--line-2, rgba(255,255,255,0.16)); color: var(--muted, #9fb0d0); }
      .chip:hover { color: var(--gold-2, #f5cc5a); }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .ready { margin-bottom: 1rem; font-size: 0.9rem; }
      .ready ul { margin: 0.5rem 0 0 1.1rem; padding: 0; list-style: disc; display: grid; gap: 0.25rem; }
      .ready.bad { border-color: rgba(251, 113, 133, 0.45); background: rgba(251, 113, 133, 0.08); }
      .ready.good { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.07); }
      .ready.off { color: var(--muted, #9fb0d0); }
      .rules { width: 100%; font-family: ui-monospace, Consolas, monospace; font-size: 0.8rem; line-height: 1.5; padding: 0.8rem; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); resize: vertical; tab-size: 2; }
      .rules-actions { display: flex; align-items: center; gap: 0.8rem; margin-top: 0.7rem; flex-wrap: wrap; }
      .tabs { display: flex; flex-wrap: wrap; width: 100%; }
      .tab { flex: 1 1 auto; min-width: 0; padding: 0.45rem 0.5rem; }
      @media (max-width: 700px) {
        .actions { width: 100%; }
        .actions .btn { flex: 1 1 auto; justify-content: center; }
      }
    `,
  ],
})
export class AdminScorecardFrameworkPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly fw = signal<FrameworkDetail | null>(null);
  protected readonly cfg = signal<FrameworkConfig | null>(null);
  protected readonly tab = signal<Tab>('dimensions');
  protected readonly activity = signal<AuditRow[]>([]);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly diffOpen = signal(false);
  protected readonly rulesText = signal('');
  protected readonly rulesError = signal('');

  protected name = '';
  protected notes = '';
  private savedSnapshot = '';
  private code = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      this.code = p.get('code') ?? '';
      this.fw.set(null);
      this.error.set('');
      this.load();
    });
  }

  private load(): void {
    this.api.framework(this.code).subscribe({
      next: (f) => this.apply(f),
      error: (e) => this.error.set(errText(e)),
    });
  }

  private apply(f: FrameworkDetail): void {
    this.fw.set(f);
    this.cfg.set(structuredClone(f.config) as FrameworkConfig);
    this.name = f.name;
    this.notes = f.notes ?? '';
    this.savedSnapshot = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify([this.cfg(), this.name, this.notes]);
  }

  protected dirty(): boolean {
    return !!this.fw() && !this.fw()!.locked && this.snapshot() !== this.savedSnapshot;
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected save(): void {
    this.busy.set(true);
    this.error.set('');
    const body = { name: this.name.trim(), notes: this.notes, config: this.cfg()! };
    this.api.updateFramework(this.code, body).subscribe({
      next: (f) => {
        this.busy.set(false);
        this.apply(f);
        this.flash('Saved');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  private run(req: ReturnType<ScorecardAdminApi['publish']>, done: string): void {
    this.busy.set(true);
    this.error.set('');
    req.subscribe({
      next: (f) => {
        this.busy.set(false);
        this.apply(f);
        this.flash(done);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  protected publish(): void {
    if (!confirm('Publish this framework? It is locked afterwards — to change it you make a new version. Seasons can only use published frameworks.')) return;
    this.run(this.api.publish(this.code), 'Published');
  }

  protected archive(): void {
    if (!confirm('Archive this framework? Existing seasons keep working, but it cannot get new ones.')) return;
    this.run(this.api.archive(this.code), 'Archived');
  }

  protected unarchive(): void {
    this.run(this.api.unarchive(this.code), 'Restored');
  }

  protected newVersion(): void {
    if (this.dirty() && !confirm('You have unsaved changes; the new version is copied from the last saved state. Continue?')) return;
    const f = this.fw();
    if (!f) return;
    const name = prompt('Name for the new version (it starts as a draft copy):', f.name.replace(/ \(v\d+\)$/, '') + ` (v${f.version + 1})`);
    if (!name || name.trim().length < 3) return;
    this.busy.set(true);
    this.api.createFramework({ name: name.trim(), cloneFrom: f.code }).subscribe({
      next: (n) => {
        this.busy.set(false);
        this.router.navigate(['/admin/scorecard', n.code]).then(() => this.flash('New draft version created'));
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected remove(): void {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    this.busy.set(true);
    this.api.deleteFramework(this.code).subscribe({
      next: () => this.router.navigate(['/admin/scorecard']),
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected diffChoices(f: FrameworkDetail): { code: string; label: string }[] {
    return f.versions.filter((v) => v.code !== f.code).map((v) => ({ code: v.code, label: v.code + ' · v' + v.version + ' (' + v.status + ')' }));
  }

  protected openRules(): void {
    this.tab.set('rules');
    this.rulesError.set('');
    this.rulesText.set(JSON.stringify(this.cfg()?.rollup ?? {}, null, 2));
  }

  protected applyRules(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.rulesText() || '{}');
    } catch (e) {
      this.rulesError.set('These rules are not valid JSON: ' + (e as Error).message);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.rulesError.set('The rules must be one object, { ... }.');
      return;
    }
    this.rulesError.set('');
    this.cfg.update((c) => ({ ...c!, rollup: parsed as Record<string, unknown> }));
    this.flash('Rules applied — save to keep them');
  }

  protected openActivity(): void {
    this.tab.set('activity');
    this.api.audit('framework', this.code).subscribe({ next: (a) => this.activity.set(a), error: (e) => this.error.set(errText(e)) });
  }
}

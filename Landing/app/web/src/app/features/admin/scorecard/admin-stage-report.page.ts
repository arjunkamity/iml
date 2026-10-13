import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  FrameworkRow,
  ReportLevel,
  RosterResponse,
  RosterRow,
  ScorecardAdminApi,
  StageStudentReport,
  errText,
} from './scorecard-admin.service';

@Component({
  selector: 'app-admin-stage-report',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <a class="back" routerLink="/admin/scorecard">← Scorecard setup</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <p class="intro">
      Per-area scores and levels for an auto-scored stage (such as Stage 1), built from the answers students gave and the framework's settings:
      which exam categories feed which area, how many questions an area needs, and where each level starts. Use it to check the report before it is released.
    </p>

    <div class="bar">
      <select class="filter" [ngModel]="comp()" (ngModelChange)="pickCompetition($event)" aria-label="Competition">
        <option value="">Choose a competition…</option>
        @for (c of competitions(); track c.code) {
          <option [value]="c.code">{{ c.title }} ({{ c.code }})</option>
        }
      </select>
      <select class="filter" [ngModel]="stage()" (ngModelChange)="stage.set($event); load(1)" [disabled]="!stages().length" aria-label="Stage">
        <option [ngValue]="0">Stage…</option>
        @for (s of stages(); track s.position) {
          <option [ngValue]="s.position">Stage {{ s.position }}: {{ s.name }}</option>
        }
      </select>
      <select class="filter" [ngModel]="framework()" (ngModelChange)="framework.set($event); load(1)" aria-label="Framework to preview with">
        <option value="">The competition's season framework</option>
        @for (f of frameworks(); track f.code) {
          <option [value]="f.code">Preview with {{ f.name }} (v{{ f.version }}, {{ f.status }})</option>
        }
      </select>
    </div>
    <div class="bar">
      <input class="search" placeholder="Student name or code" [(ngModel)]="search" (keyup.enter)="load(1)" />
      <input class="filter" placeholder="Grade" [(ngModel)]="grade" (keyup.enter)="load(1)" style="min-width:90px;max-width:110px" />
      <input class="filter" placeholder="School code" [(ngModel)]="school" (keyup.enter)="load(1)" style="min-width:120px;max-width:150px" />
      <button class="btn" [disabled]="!ready()" (click)="load(1)">Apply</button>
      <div class="grow"></div>
      <button class="btn btn-gold" [disabled]="!ready() || exporting() || !data()?.total" (click)="exportXlsx()">{{ exporting() ? 'Preparing…' : 'Download Excel' }}</button>
    </div>

    @if (!ready()) {
      <div class="card empty">Choose a competition and a stage to see the report figures.</div>
    } @else if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (data(); as d) {
      <div class="card info">
        <div><b>{{ d.competition.title }}</b> · Stage {{ d.stage.position }}: {{ d.stage.name }}</div>
        <small>
          Framework {{ d.framework.code }} "{{ d.framework.name }}" (v{{ d.framework.version }}, {{ d.framework.status }}) · scale {{ d.scale.name }} ·
          an area needs at least {{ d.minQuestionsPerArea }} questions · {{ d.total }} finished attempt(s)
        </small>
        <div class="legend">
          @for (l of d.scale.levels; track l.key; let i = $index) {
            <span class="lv" [class]="'lv c' + (i % 4)" [title]="l.meaning">{{ l.label }} {{ l.minPercent }}%+</span>
          }
        </div>
      </div>

      @if (!d.rows.length) {
        <div class="card empty">No finished attempts match.</div>
      } @else {
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                @for (a of d.columns.areas; track a.competency) {
                  <th>{{ a.name }}</th>
                }
                @for (x of d.columns.dimensions; track x.key) {
                  <th>{{ x.label }} overall</th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.rows; track r.attemptCode) {
                <tr>
                  <td data-label="Student"><span class="b">{{ r.student.name }}</span><small>{{ r.student.code }} · grade {{ r.student.grade }}{{ r.student.school ? ' · ' + r.student.school : '' }}</small></td>
                  @for (a of d.columns.areas; track a.competency) {
                    <td [attr.data-label]="a.name">
                      @if (r.areas[a.competency]; as x) {
                        @if (x.percent !== null) {
                          <span class="pct">{{ pct(x.percent) }}%</span> <span class="lv" [class]="'lv ' + cls(d.scale.levels, x.level)">{{ x.level }}</span>
                        } @else {
                          <span class="na" [title]="x.total + ' questions served'">{{ x.status === 'no_questions' ? 'none' : 'only ' + x.total }}</span>
                        }
                      } @else { — }
                    </td>
                  }
                  @for (x of d.columns.dimensions; track x.key) {
                    <td [attr.data-label]="x.label + ' overall'">
                      @if (r.dimensions[x.key]; as o) {
                        @if (o.percent !== null) {
                          <b>{{ pct(o.percent) }}%</b> <span class="lv" [class]="'lv ' + cls(d.scale.levels, o.level)">{{ o.level }}</span>
                        } @else { — }
                      }
                      @if (r.unmapped) { <small class="warn">{{ r.unmapped }} question(s) in unmapped categories</small> }
                    </td>
                  }
                  <td><div class="acts"><button class="btn btn-sm" (click)="open(r)">Preview</button></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span>{{ (d.page - 1) * d.limit + 1 }}–{{ Math.min(d.page * d.limit, d.total) }} of {{ d.total }}</span>
          <button class="btn btn-sm" [disabled]="d.page <= 1" (click)="load(d.page - 1)">Previous</button>
          <button class="btn btn-sm" [disabled]="d.page * d.limit >= d.total" (click)="load(d.page + 1)">Next</button>
        </div>
      }
    }

    @if (detail(); as p) {
      <div class="modal-root" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ p.student?.name }} · {{ p.student?.code }}</h3><button class="m-x" (click)="detail.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            <dl class="dl">
              <dt>Grade</dt><dd>{{ p.student?.grade }}</dd>
              <dt>School</dt><dd>{{ p.student?.school || '—' }}</dd>
              <dt>Competition</dt><dd>{{ p.competition.title }}</dd>
              @if (p.season) { <dt>Edition</dt><dd>{{ p.season.editionLabel }}</dd> }
              <dt>Stage</dt><dd>Stage {{ p.stage.position }}: {{ p.stage.name }}</dd>
              @if (p.attempt) { <dt>Attempt</dt><dd>{{ p.attempt.code }} · finished {{ p.attempt.finishedAt | date: 'd MMM y, h:mm a' }}</dd> }
            </dl>

            @if (p.status !== 'ready') {
              <div class="card empty">{{ p.status === 'in_progress' ? 'The attempt is not finished yet.' : 'This student has not attempted this stage.' }}</div>
            } @else if (p.report; as rep) {
              @for (dim of rep.dimensions; track dim.dimension) {
                <div class="dim-head">
                  <div><b>{{ dim.label }}</b>@if (dim.subtitle) { <small> · {{ dim.subtitle }}</small> }</div>
                </div>
                @for (a of dim.areas; track a.competency) {
                  <div class="area">
                    <div class="area-top">
                      <b>{{ a.name }}</b>
                      @if (a.percent !== null) {
                        <span><span class="pct">{{ pct(a.percent) }}%</span> <span class="lv" [class]="'lv ' + cls(p.scale.levels, a.level?.label ?? null)">{{ a.level?.label }}</span></span>
                      } @else {
                        <span class="na">{{ a.status === 'no_questions' ? 'No questions served' : 'Not enough questions (' + a.total + ')' }}</span>
                      }
                    </div>
                    <div class="meter"><i [style.width.%]="a.percent ?? 0" [class]="'c' + levelIndex(p.scale.levels, a.level?.label ?? null)"></i></div>
                    <small>{{ a.correct }} of {{ a.total }} correct · categories {{ a.categories.join(', ') }}</small>
                  </div>
                }
                <div class="overall">
                  Overall {{ dim.label }}:
                  @if (dim.overall; as o) {
                    <b>{{ pct(o.percent) }}% — {{ o.level?.label }}</b> <small>({{ o.correct }} of {{ o.total }})</small>
                  } @else { not enough questions }
                </div>
              }
              @if (rep.unmapped.length) {
                <div class="lock-note">
                  These categories are in the answers but not mapped to any area, so they are not in the figures above:
                  @for (u of rep.unmapped; track u.category) { <b>{{ u.category }}</b> ({{ u.correct }} of {{ u.total }}) }.
                  Map them under Competencies in the framework.
                </div>
              }
              <div class="sec">Level scale: {{ p.scale.name }}</div>
              @for (l of p.scale.levels; track l.key) {
                <div class="lvrow"><b>{{ l.label }}</b> <small>from {{ l.minPercent }}%</small> — {{ l.meaning }}</div>
              }
            }
          </div>
          <div class="m-foot"><button class="btn" (click)="detail.set(null)">Close</button></div>
        </div>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .back:hover { color: var(--gold-2, #f5cc5a); }
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.1rem; }
      .info { margin-bottom: 1rem; }
      .info small { color: var(--faint, #6e7f9e); display: block; margin-top: 0.2rem; }
      .legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
      .lv { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 0.12rem 0.55rem; border-radius: 999px; border: 1px solid var(--line-2, rgba(255,255,255,0.16)); white-space: nowrap; }
      .lv.c0 { background: rgba(100, 116, 139, 0.25); } .lv.c1 { background: rgba(37, 99, 235, 0.22); }
      .lv.c2 { background: rgba(5, 150, 105, 0.22); } .lv.c3 { background: rgba(183, 121, 31, 0.3); }
      .pct { font-weight: 800; font-variant-numeric: tabular-nums; }
      .na { color: var(--faint, #6e7f9e); font-size: 0.8rem; }
      td small.warn { color: #fda4af; display: block; }
      .dim-head { margin: 1.1rem 0 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .dim-head small { color: var(--faint, #6e7f9e); }
      .area { margin-bottom: 0.9rem; }
      .area-top { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.3rem; font-size: 0.92rem; }
      .meter { height: 8px; border-radius: 5px; background: rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 0.25rem; }
      .meter i { display: block; height: 100%; border-radius: 5px; background: var(--gold, #e8b64a); }
      .meter i.c0 { background: #64748b; } .meter i.c1 { background: #3b82f6; } .meter i.c2 { background: #10b981; } .meter i.c3 { background: #f5cc5a; }
      .overall { margin: 0.4rem 0 1rem; padding: 0.7rem 0.9rem; border-radius: 10px; background: rgba(232, 182, 74, 0.08); border: 1px solid rgba(232, 182, 74, 0.3); }
      .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin: 0.8rem 0; }
      .lvrow { font-size: 0.85rem; margin-bottom: 0.3rem; color: var(--muted, #9fb0d0); }
      .lvrow small { color: var(--faint, #6e7f9e); }
    `,
  ],
})
export class AdminStageReportPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);

  protected readonly Math = Math;
  protected readonly competitions = signal<{ code: string; title: string; status: string }[]>([]);
  protected readonly frameworks = signal<FrameworkRow[]>([]);
  protected readonly stages = signal<{ position: number; name: string; mode: string }[]>([]);
  protected readonly comp = signal('');
  protected readonly stage = signal(0);
  protected readonly framework = signal('');
  protected readonly data = signal<RosterResponse | null>(null);
  protected readonly detail = signal<StageStudentReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');

  protected search = '';
  protected grade = '';
  protected school = '';

  ngOnInit(): void {
    this.api.competitions().subscribe({ next: (r) => this.competitions.set(r.data), error: (e) => this.error.set(errText(e)) });
    this.api.frameworks().subscribe({ next: (f) => this.frameworks.set(f) });
  }

  protected ready(): boolean {
    return !!this.comp() && this.stage() > 0;
  }

  protected pickCompetition(code: string): void {
    this.comp.set(code);
    this.stage.set(0);
    this.data.set(null);
    this.stages.set([]);
    this.error.set('');
    if (!code) return;
    this.api.stages(code).subscribe({
      next: (s) => {
        this.stages.set(s);
        // The first stage is the usual auto-scored one.
        if (s.length) {
          this.stage.set(s[0].position);
          this.load(1);
        }
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  private filters() {
    return { comp: this.comp(), stage: this.stage(), framework: this.framework(), search: this.search.trim(), grade: this.grade.trim(), school: this.school.trim() };
  }

  protected load(page: number): void {
    if (!this.ready()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.stageRoster(this.filters(), page).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.data.set(null);
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected open(r: RosterRow): void {
    this.api.stageReport(this.comp(), this.stage(), r.student.code, this.framework() || undefined).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected exportXlsx(): void {
    this.exporting.set(true);
    this.api.exportRoster(this.filters()).subscribe({
      next: () => this.exporting.set(false),
      error: (e) => {
        this.exporting.set(false);
        this.error.set(errText(e));
      },
    });
  }

  /** Up to two decimals; the level itself is always decided on the exact value. */
  protected pct(v: number): string {
    return String(Number(v.toFixed(2)));
  }

  protected levelIndex(levels: ReportLevel[], label: string | null): number {
    const sorted = levels.slice().sort((a, b) => a.points - b.points);
    return Math.max(0, sorted.findIndex((l) => l.label === label)) % 4;
  }

  protected cls(levels: ReportLevel[], label: string | null): string {
    return 'c' + this.levelIndex(levels, label);
  }
}

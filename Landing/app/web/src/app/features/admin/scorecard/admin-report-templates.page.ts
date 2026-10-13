import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { ConfigDiffDialog } from './config-diff.dialog';
import { ScorecardAdminApi, SectionTypeInfo, TemplateConfigCfg, TemplateDetail, TemplateRow, errText } from './scorecard-admin.service';

@Component({
  selector: 'app-admin-report-templates',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ConfigDiffDialog],
  template: `
    <a class="back" [routerLink]="code() ? '/admin/scorecard/templates' : '/admin/scorecard'">← {{ code() ? 'Report templates' : 'Scorecard setup' }}</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (!code()) {
      <!-- ============================================================== list -->
      <p class="intro">
        A report template is the layout of the PDF: which sections it has and in what order, the headings and labels they print, and the colours.
        The wording itself comes from the content library. A published template is locked, so reports already issued never change — make a new version to change it.
      </p>
      <div class="bar">
        <h3 style="margin:0">Report templates</h3>
        <div class="grow"></div>
        <button class="btn btn-gold" (click)="openNew()">+ New template</button>
      </div>
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else if (!templates().length) {
        <div class="card empty">No templates yet. Create one, or ask a developer to run the sample template seed.</div>
      } @else {
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Template</th><th>Status</th><th>Sections</th><th>Used by seasons</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              @for (t of templates(); track t.code) {
                <tr>
                  <td data-label="Template"><a class="b link" [routerLink]="['/admin/scorecard/templates', t.code]">{{ t.name }}</a><small>{{ t.code }} · version {{ t.version }}</small></td>
                  <td data-label="Status">
                    <span class="bdg" [class.green]="t.status === 'Published'" [class.gold]="t.status === 'Draft'" [class.grey]="t.status === 'Archived'">{{ t.status }}</span>
                    @if (t.status === 'Draft' && t.issues) { <small class="warn">{{ t.issues }} to fix</small> }
                  </td>
                  <td data-label="Sections">{{ t.sections }}</td>
                  <td data-label="Seasons">{{ t.seasons.length ? seasonNames(t) : '—' }}</td>
                  <td data-label="Updated">{{ t.updatedAt | date: 'd MMM y' }}</td>
                  <td><div class="acts"><a class="btn btn-sm" [routerLink]="['/admin/scorecard/templates', t.code]">Open</a></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (tpl(); as t) {
      <!-- ============================================================ editor -->
      @if (diffOpen()) {
        <app-config-diff kind="template" [code]="t.code" [choices]="diffChoices(t)" (closed)="diffOpen.set(false)" />
      }
      <div class="head">
        <div class="titles">
          <div class="line">
            <span class="bdg" [class.green]="t.status === 'Published'" [class.gold]="t.status === 'Draft'" [class.grey]="t.status === 'Archived'">{{ t.status }}</span>
            <span class="codeline">{{ t.code }} · version {{ t.version }}</span>
            @for (v of t.versions; track v.code) {
              @if (v.code !== t.code) { <a class="chip" [routerLink]="['/admin/scorecard/templates', v.code]">v{{ v.version }} ({{ v.status }})</a> }
            }
          </div>
          <h2>{{ t.name }}</h2>
          <small class="codeline">
            {{ t.config.sections.length }} sections
            @if (t.publishedAt) { · published {{ t.publishedAt | date: 'd MMM y' }} }
            @if (t.seasons.length) { · used by {{ seasonNames(t) }} }
          </small>
        </div>
        <div class="actions">
          @if (!t.locked) {
            <button class="btn btn-gold" [disabled]="busy() || !dirty()" (click)="save()">{{ busy() ? 'Saving…' : 'Save changes' }}</button>
            <button class="btn" [disabled]="busy() || dirty() || t.issues.length > 0" [title]="dirty() ? 'Save your changes first' : t.issues.length ? 'Fix the items below first' : ''" (click)="publish()">Publish</button>
          }
          @if (t.status === 'Published') { <button class="btn" [disabled]="busy()" (click)="archive()">Archive</button> }
          @if (t.status === 'Archived') { <button class="btn" [disabled]="busy()" (click)="unarchive()">Restore</button> }
          <button class="btn" (click)="diffOpen.set(true)">Compare versions</button>
          <button class="btn" [disabled]="busy()" (click)="newVersion()">Make a new version</button>
          @if (t.status === 'Draft') { <button class="btn btn-danger" [disabled]="busy()" (click)="remove()">Delete</button> }
        </div>
      </div>

      @if (t.status === 'Draft') {
        @if (dirty()) {
          <div class="card ready off">You have unsaved changes. Save to refresh the checklist.</div>
        } @else if (t.issues.length) {
          <div class="card ready bad">
            <b>Not ready to publish yet</b>
            <ul>@for (i of t.issues; track $index) { <li>{{ i }}</li> }</ul>
          </div>
        } @else {
          <div class="card ready good"><b>Ready to publish.</b> Once published it is locked; change it later by making a new version.</div>
        }
      } @else {
        <div class="card ready off">{{ t.status === 'Published' ? 'Published and locked, so reports issued with it never change.' : 'Archived — it cannot be given to new seasons.' }}</div>
      }

      @if (cfg(); as c) {
        <div class="card" style="margin-bottom:1rem">
          <div class="sec" style="margin-top:0">Name and look</div>
          <div class="f-row">
            <div class="f"><label for="tp-name">Name</label><input id="tp-name" type="text" [(ngModel)]="name" [disabled]="t.locked" maxlength="190" /></div>
            <div class="f"><label for="tp-notes">Notes</label><input id="tp-notes" type="text" [(ngModel)]="notes" [disabled]="t.locked" placeholder="Anything the next editor should know" /></div>
          </div>
          <div class="f-row">
            <div class="f"><label for="tp-logo">Logo <small>(web address; empty uses the IML logo from Site Settings)</small></label><input id="tp-logo" type="url" [(ngModel)]="c.branding.logoUrl" [disabled]="t.locked" placeholder="https://…" /></div>
            <div class="f"><label for="tp-foot">Footer text <small>(left of every page footer)</small></label><input id="tp-foot" type="text" [(ngModel)]="c.branding.footerText" [disabled]="t.locked" maxlength="160" /></div>
          </div>
          <div class="colors">
            @for (k of mainColors; track k.key) {
              <div class="col">
                <label [for]="'c-' + k.key">{{ k.label }}</label>
                <div class="pick"><input [id]="'c-' + k.key" type="color" [ngModel]="branding(k.key)" (ngModelChange)="setBranding(k.key, $event)" [disabled]="t.locked" /><input type="text" [ngModel]="branding(k.key)" (ngModelChange)="setBranding(k.key, $event)" [disabled]="t.locked" maxlength="7" aria-label="Hex value" /></div>
              </div>
            }
          </div>

          <div class="sec">Stage colours <small>(the heading band of a stage's results)</small></div>
          <div class="kv">
            @for (k of stageColorKeys(); track k) {
              <div class="pick"><b>Stage {{ k }}</b><input type="color" [ngModel]="c.branding.stageColors[k]" (ngModelChange)="c.branding.stageColors[k] = $event" [disabled]="t.locked" /><input type="text" [(ngModel)]="c.branding.stageColors[k]" [disabled]="t.locked" maxlength="7" aria-label="Hex value" />
                @if (!t.locked) { <button class="btn btn-sm" (click)="removeStageColor(k)" aria-label="Remove">✕</button> }</div>
            }
            @if (!t.locked) {
              <div class="pick"><input type="number" min="1" max="12" placeholder="Stage" [(ngModel)]="newStage" style="width:90px" aria-label="New stage number" /><button class="btn btn-sm" [disabled]="!newStage" (click)="addStageColor()">Add stage colour</button></div>
            }
          </div>

          <div class="sec">Level colours <small>(level chips and bars; use the level keys of your scale, e.g. ADVANCED)</small></div>
          <div class="kv">
            @for (k of levelColorKeys(); track k) {
              <div class="pick"><b>{{ k }}</b><input type="color" [ngModel]="c.branding.levelColors[k]" (ngModelChange)="c.branding.levelColors[k] = $event" [disabled]="t.locked" /><input type="text" [(ngModel)]="c.branding.levelColors[k]" [disabled]="t.locked" maxlength="7" aria-label="Hex value" />
                @if (!t.locked) { <button class="btn btn-sm" (click)="removeLevelColor(k)" aria-label="Remove">✕</button> }</div>
            }
            @if (!t.locked) {
              <div class="pick"><input type="text" placeholder="LEVEL_KEY" [(ngModel)]="newLevel" style="width:140px" aria-label="New level key" /><button class="btn btn-sm" [disabled]="!newLevel.trim()" (click)="addLevelColor()">Add level colour</button></div>
            }
          </div>
        </div>

        <div class="bar">
          <h3 style="margin:0">Sections, in report order</h3>
          <div class="grow"></div>
          @if (!t.locked) {
            <select class="filter" [(ngModel)]="newType" aria-label="Kind of section to add">
              @for (s of sectionTypes(); track s.type) { <option [value]="s.type">{{ s.label }}</option> }
            </select>
            <button class="btn btn-gold" (click)="addSection()">+ Add section</button>
          }
        </div>

        @for (s of c.sections; track s.key; let i = $index) {
          <div class="card sect" [class.off]="!s.enabled">
            <div class="sect-head">
              <label class="chk"><input type="checkbox" [(ngModel)]="s.enabled" [disabled]="t.locked" /> <b>{{ info(s.type)?.label ?? s.type }}</b></label>
              <small class="muted">{{ s.key }}@if (s.stage) { · stage {{ s.stage }} }</small>
              <div class="grow"></div>
              @if (!t.locked) {
                <button class="btn btn-sm" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Move up">↑</button>
                <button class="btn btn-sm" [disabled]="i === c.sections.length - 1" (click)="move(i, 1)" aria-label="Move down">↓</button>
                <button class="btn btn-sm btn-danger" (click)="removeSection(i)">Remove</button>
              }
            </div>
            <div class="hint">{{ info(s.type)?.help }}</div>
            <div class="f-row">
              @if (info(s.type)?.stage) {
                <div class="f"><label [for]="'st-' + s.key">Stage</label><input [id]="'st-' + s.key" type="number" min="1" max="12" [(ngModel)]="s.stage" [disabled]="t.locked" /></div>
              }
              <div class="f"><label class="chk"><input type="checkbox" [(ngModel)]="s.pageBreakBefore" [disabled]="t.locked" /> Start on a new page</label></div>
              @if (s.type === 'stage_results' || s.type === 'bar_profile') {
                <div class="f"><label [for]="'pd-' + s.key">Decimals on percentages</label><input [id]="'pd-' + s.key" type="number" min="0" max="2" [(ngModel)]="s.percentDecimals" [disabled]="t.locked" /></div>
              }
            </div>
            <div class="aud">
              <span class="muted">Shown to (the admin copy always has every section):</span>
              @for (a of audiences; track a.key) {
                <label class="chk"><input type="checkbox" [checked]="sees(s, a.key)" (change)="toggleAudience(s, a.key)" [disabled]="t.locked" /> {{ a.label }}</label>
              }
            </div>
            <div class="labels">
              @for (l of info(s.type)?.labels ?? []; track l.key) {
                <div class="f">
                  <label [for]="'lb-' + s.key + l.key">{{ l.label }}</label>
                  <input [id]="'lb-' + s.key + l.key" type="text" [ngModel]="s.labels[l.key] ?? ''" (ngModelChange)="s.labels[l.key] = $event" [disabled]="t.locked" [placeholder]="l.help ?? ''" />
                </div>
              }
            </div>
          </div>
        }
        @if (!c.sections.length) {
          <div class="card empty">No sections yet. Add the first one above.</div>
        }
      }
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }

    @if (newOpen()) {
      <div class="modal-root" (click)="newOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>New report template</h3><button class="m-x" (click)="newOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f full"><label for="nt-name">Name</label><input id="nt-name" type="text" [(ngModel)]="draft.name" maxlength="190" /></div>
            <div class="f full">
              <label for="nt-from">Start from</label>
              <select id="nt-from" [(ngModel)]="draft.cloneFrom">
                <option value="">An empty template</option>
                @for (x of templates(); track x.code) { <option [value]="x.code">A copy of {{ x.name }} ({{ x.code }}, v{{ x.version }})</option> }
              </select>
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="newOpen.set(false)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || draft.name.trim().length < 3" (click)="create()">{{ busy() ? 'Creating…' : 'Create draft' }}</button>
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
      .back:hover { color: var(--gold-2, #f5cc5a); }
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.2rem; }
      a.link:hover { color: var(--gold-2, #f5cc5a); }
      td small.warn { color: #fda4af; display: block; }
      td small { display: block; color: var(--faint, #6e7f9e); }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .titles { min-width: 0; flex: 1 1 320px; }
      .titles .line { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
      .titles h2 { margin: 0 0 0.25rem; font-size: 1.5rem; line-height: 1.2; text-wrap: balance; }
      .codeline { color: var(--faint, #6e7f9e); font-size: 0.8rem; font-weight: 700; }
      .chip { font-size: 0.74rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--line-2, rgba(255,255,255,0.16)); color: var(--muted, #9fb0d0); }
      .chip:hover { color: var(--gold-2, #f5cc5a); }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .ready { margin-bottom: 1rem; font-size: 0.9rem; }
      .ready ul { margin: 0.5rem 0 0 1.1rem; padding: 0; list-style: disc; display: grid; gap: 0.25rem; }
      .ready.bad { border-color: rgba(251, 113, 133, 0.45); background: rgba(251, 113, 133, 0.08); }
      .ready.good { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.07); }
      .ready.off { color: var(--muted, #9fb0d0); }
      .f small, .sec small { font-weight: 500; color: var(--faint, #6e7f9e); text-transform: none; letter-spacing: 0; }
      .colors { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.8rem; margin-top: 0.4rem; }
      .pick { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
      .pick input[type='color'] { width: 40px; height: 34px; padding: 0; border: 1px solid var(--line, rgba(255,255,255,0.12)); border-radius: 8px; background: none; cursor: pointer; }
      .pick input[type='text'] { width: 96px; }
      .kv { display: grid; gap: 0.5rem; }
      .sect { margin-bottom: 0.7rem; }
      .sect.off { opacity: 0.65; }
      .sect-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
      .aud { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin: 0.2rem 0 0.6rem; font-size: 0.85rem; }
      .aud .chk { margin: 0; }
      .labels { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.7rem; margin-top: 0.4rem; }
      .chk { display: flex; align-items: center; gap: 0.45rem; font-size: 0.88rem; cursor: pointer; }
      .chk input { width: auto; accent-color: var(--gold, #e8b64a); }
      .muted { color: var(--faint, #6e7f9e); }
      .hint { font-size: 0.8rem; color: var(--faint, #6e7f9e); margin: 0.25rem 0 0.5rem; }
      @media (max-width: 700px) {
        .actions { width: 100%; }
        .actions .btn { flex: 1 1 auto; justify-content: center; }
      }
    `,
  ],
})
export class AdminReportTemplatesPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly code = signal('');
  protected readonly templates = signal<TemplateRow[]>([]);
  protected readonly tpl = signal<TemplateDetail | null>(null);
  protected readonly cfg = signal<TemplateConfigCfg | null>(null);
  protected readonly sectionTypes = signal<SectionTypeInfo[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly diffOpen = signal(false);

  protected diffChoices(t: TemplateDetail): { code: string; label: string }[] {
    return t.versions.filter((v) => v.code !== t.code).map((v) => ({ code: v.code, label: v.code + ' · v' + v.version + ' (' + v.status + ')' }));
  }
  protected readonly newOpen = signal(false);

  protected draft = { name: '', cloneFrom: '' };
  protected name = '';
  protected notes = '';
  protected newType = 'stage_results';
  protected newStage: number | null = null;
  protected newLevel = '';
  protected readonly mainColors = [
    { key: 'primaryColor', label: 'Headings and table headers' },
    { key: 'accentColor', label: 'Emphasis (overall score)' },
    { key: 'highlightColor', label: 'Rules and highlights' },
  ] as const;
  private saved = '';

  protected readonly stageColorKeys = computed(() => Object.keys(this.cfg()?.branding.stageColors ?? {}).sort((a, b) => Number(a) - Number(b)));
  protected readonly levelColorKeys = computed(() => Object.keys(this.cfg()?.branding.levelColors ?? {}));

  ngOnInit(): void {
    this.api.templateMeta().subscribe({ next: (m) => this.sectionTypes.set(m.sectionTypes), error: (e) => this.error.set(errText(e)) });
    this.route.paramMap.subscribe((p) => {
      this.code.set(p.get('code') ?? '');
      this.error.set('');
      this.tpl.set(null);
      this.load();
    });
  }

  private load(): void {
    if (!this.code()) {
      this.loading.set(true);
      this.api.templates().subscribe({
        next: (t) => {
          this.templates.set(t);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(errText(e));
          this.loading.set(false);
        },
      });
      return;
    }
    this.api.template(this.code()).subscribe({ next: (t) => this.apply(t), error: (e) => this.error.set(errText(e)) });
  }

  private apply(t: TemplateDetail): void {
    this.tpl.set(t);
    this.cfg.set(structuredClone(t.config) as TemplateConfigCfg);
    this.name = t.name;
    this.notes = t.notes ?? '';
    this.saved = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify([this.cfg(), this.name, this.notes]);
  }

  protected dirty(): boolean {
    return !!this.tpl() && !this.tpl()!.locked && this.snapshot() !== this.saved;
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected seasonNames(t: { seasons: { name: string }[] }): string {
    return t.seasons.map((s) => s.name).join(', ');
  }

  protected info(type: string): SectionTypeInfo | undefined {
    return this.sectionTypes().find((s) => s.type === type);
  }

  protected branding(key: string): string {
    return (this.cfg()?.branding as unknown as Record<string, string>)[key] ?? '';
  }

  protected setBranding(key: string, v: string): void {
    const c = this.cfg();
    if (c) (c.branding as unknown as Record<string, string>)[key] = v;
  }

  // ---- stage and level colours
  protected addStageColor(): void {
    const c = this.cfg();
    if (!c || !this.newStage) return;
    c.branding.stageColors[String(this.newStage)] = c.branding.primaryColor;
    this.cfg.set({ ...c });
    this.newStage = null;
  }

  protected removeStageColor(k: string): void {
    const c = this.cfg();
    if (!c) return;
    delete c.branding.stageColors[k];
    this.cfg.set({ ...c });
  }

  protected addLevelColor(): void {
    const c = this.cfg();
    const k = this.newLevel.trim().toUpperCase();
    if (!c || !k) return;
    c.branding.levelColors[k] = c.branding.accentColor;
    this.cfg.set({ ...c });
    this.newLevel = '';
  }

  protected removeLevelColor(k: string): void {
    const c = this.cfg();
    if (!c) return;
    delete c.branding.levelColors[k];
    this.cfg.set({ ...c });
  }

  // ---- who sees a section
  protected readonly audiences = [
    { key: 'student', label: 'Student' },
    { key: 'parent', label: 'Parent' },
    { key: 'school', label: 'School' },
  ];

  protected sees(s: { audiences?: string[] }, a: string): boolean {
    return !s.audiences || s.audiences.includes(a);
  }

  protected toggleAudience(s: { audiences?: string[] }, a: string): void {
    const all = this.audiences.map((x) => x.key);
    const cur = s.audiences ?? all;
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
    s.audiences = next.length === all.length ? undefined : next;
  }

  // ---- sections
  protected addSection(): void {
    const c = this.cfg();
    const info = this.info(this.newType);
    if (!c || !info) return;
    const used = new Set(c.sections.map((s) => s.key));
    let key = info.type;
    for (let n = 2; used.has(key); n++) key = `${info.type}${n}`;
    c.sections.push({ key, type: info.type, enabled: true, labels: Object.fromEntries(info.labels.map((l) => [l.key, ''])), ...(info.stage ? { stage: 1 } : {}) });
    this.cfg.set({ ...c });
  }

  protected move(i: number, d: number): void {
    const c = this.cfg();
    if (!c) return;
    const j = i + d;
    if (j < 0 || j >= c.sections.length) return;
    [c.sections[i], c.sections[j]] = [c.sections[j], c.sections[i]];
    this.cfg.set({ ...c });
  }

  protected removeSection(i: number): void {
    const c = this.cfg();
    if (!c || !confirm('Remove this section from the template?')) return;
    c.sections.splice(i, 1);
    this.cfg.set({ ...c });
  }

  // ---- lifecycle
  protected openNew(): void {
    this.draft = { name: '', cloneFrom: '' };
    this.modalError.set('');
    this.newOpen.set(true);
  }

  protected create(): void {
    this.busy.set(true);
    this.modalError.set('');
    this.api.createTemplate({ name: this.draft.name.trim(), cloneFrom: this.draft.cloneFrom || undefined }).subscribe({
      next: (t) => {
        this.busy.set(false);
        this.newOpen.set(false);
        this.router.navigate(['/admin/scorecard/templates', t.code]);
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected save(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.updateTemplate(this.code(), { name: this.name.trim(), notes: this.notes, config: this.cfg()! }).subscribe({
      next: (t) => {
        this.busy.set(false);
        this.apply(t);
        this.flash('Saved');
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(errText(e));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private run(req: ReturnType<ScorecardAdminApi['publishTemplate']>, done: string): void {
    this.busy.set(true);
    this.error.set('');
    req.subscribe({
      next: (t) => {
        this.busy.set(false);
        this.apply(t);
        this.flash(done);
      },
      error: (e) => this.fail(e),
    });
  }

  protected publish(): void {
    if (!confirm('Publish this template? It is locked afterwards — to change it you make a new version. Seasons can only use published templates.')) return;
    this.run(this.api.publishTemplate(this.code()), 'Published');
  }

  protected archive(): void {
    if (!confirm('Archive this template? Reports already issued keep working, but it cannot be given to new seasons.')) return;
    this.run(this.api.archiveTemplate(this.code()), 'Archived');
  }

  protected unarchive(): void {
    this.run(this.api.unarchiveTemplate(this.code()), 'Restored');
  }

  protected newVersion(): void {
    if (this.dirty() && !confirm('You have unsaved changes; the new version is copied from the last saved state. Continue?')) return;
    const t = this.tpl();
    if (!t) return;
    const name = prompt('Name for the new version (it starts as a draft copy):', t.name.replace(/ \(v\d+\)$/, '') + ` (v${t.version + 1})`);
    if (!name || name.trim().length < 3) return;
    this.busy.set(true);
    this.api.createTemplate({ name: name.trim(), cloneFrom: t.code }).subscribe({
      next: (n) => {
        this.busy.set(false);
        this.router.navigate(['/admin/scorecard/templates', n.code]).then(() => this.flash('New draft version created'));
      },
      error: (e) => this.fail(e),
    });
  }

  protected remove(): void {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    this.busy.set(true);
    this.api.deleteTemplate(this.code()).subscribe({
      next: () => this.router.navigate(['/admin/scorecard/templates']),
      error: (e) => this.fail(e),
    });
  }
}

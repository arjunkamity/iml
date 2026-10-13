import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { FrameworkRow, ImportCheck, LibraryRow, ScorecardAdminApi, SeasonRow, TemplateRow, errText } from './scorecard-admin.service';

interface SeasonEditor {
  code: string | null;
  name: string;
  editionLabel: string;
  year: number | null;
  idPattern: string;
  frameworkCode: string;
  scaleKey: string;
  libraryCode: string;
  templateCode: string;
  consentRequired: boolean;
  notifyStudent: boolean;
  linkValidDays: number;
  active: boolean;
  scaleOptions: { key: string; name: string }[];
  /** competition code -> { in the season?, scale override } */
  comps: { code: string; title: string; status: string; on: boolean; scaleKey: string; taken: string | null }[];
}

/** Same rules as the server's formatImlId, for the live example. */
function idExample(pattern: string, year: number, code: string): string {
  return pattern
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year % 100).padStart(2, '0'))
    .replace(/\{SEASON\}/g, code)
    .replace(/\{(#{1,10})\}/g, (_, h: string) => String(124).padStart(h.length, '0'));
}

@Component({
  selector: 'app-admin-scorecard',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <p class="intro">
      Everything the Future Readiness scorecard needs is set up here, with no code change: the dimensions, level scales and competencies
      (a <b>framework</b>), and the edition label and ID pattern that tie it to competitions (a <b>season</b>). A published framework is locked, so reports already
      issued never change — make a new version to change it.
    </p>

    <div class="bar">
      <h3 style="margin:0">Frameworks</h3>
      <div class="grow"></div>
      <a class="btn" routerLink="/admin/scorecard/templates">Report templates</a>
      <a class="btn" routerLink="/admin/scorecard/content">Content library</a>
      <a class="btn" routerLink="/admin/scorecard/reports">Reports</a>
      <a class="btn" routerLink="/admin/scorecard/stage-report">Stage reports</a>
      <a class="btn" routerLink="/admin/scorecard/audit">Change history</a>
      <button class="btn btn-gold" (click)="openNew()">+ New framework</button>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!frameworks().length) {
      <div class="card empty">No frameworks yet. Create one, or ask a developer to run the sample seed to start from the client's report.</div>
    } @else {
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Framework</th><th>Status</th><th>Contents</th><th>Seasons</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            @for (f of frameworks(); track f.code) {
              <tr>
                <td data-label="Framework"><a class="b link" [routerLink]="['/admin/scorecard', f.code]">{{ f.name }}</a><small>{{ f.code }} · version {{ f.version }}</small></td>
                <td data-label="Status">
                  <span class="bdg" [class.green]="f.status === 'Published'" [class.gold]="f.status === 'Draft'" [class.grey]="f.status === 'Archived'">{{ f.status }}</span>
                  @if (f.status === 'Draft' && f.issues) {
                    <small class="warn">{{ f.issues }} to fix</small>
                  }
                </td>
                <td data-label="Contents">{{ f.dimensions }} dimensions · {{ f.scales }} scale(s) · {{ f.competencies }} competencies</td>
                <td data-label="Seasons">{{ f.seasons }}</td>
                <td data-label="Updated">{{ f.updatedAt | date: 'd MMM y' }}</td>
                <td><div class="acts"><a class="btn btn-sm" [routerLink]="['/admin/scorecard', f.code]">Open</a></div></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <div class="bar" style="margin-top:2rem">
      <h3 style="margin:0">Seasons</h3>
      <div class="grow"></div>
      <button class="btn" (click)="openImport()">Import settings</button>
      <button class="btn btn-gold" [disabled]="!published().length" [title]="published().length ? '' : 'Publish a framework first'" (click)="openSeason(null)">+ New season</button>
    </div>
    @if (!seasons().length) {
      <div class="card empty">No seasons yet. A season ties a published framework to an edition and to the competitions it covers.</div>
    } @else {
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Season</th><th>Edition</th><th>Framework and scale</th><th>Wording and layout</th><th>ID example</th><th>Competitions</th><th></th></tr></thead>
          <tbody>
            @for (s of seasons(); track s.code) {
              <tr>
                <td data-label="Season">
                  <span class="b">{{ s.name }}</span><small>{{ s.code }}</small>
                  @if (!s.active) { <span class="bdg grey">Off</span> }
                </td>
                <td data-label="Edition">{{ s.editionLabel }}</td>
                <td data-label="Framework and scale">{{ s.framework.name }} <small>v{{ s.framework.version }} · scale {{ s.effectiveScale || '—' }}</small></td>
                <td data-label="Wording and layout">{{ s.library ? s.library.name : '—' }}<small>{{ s.template ? s.template.name + ' v' + s.template.version : 'no report template' }}</small></td>
                <td data-label="ID example"><code>{{ s.idExample }}</code></td>
                <td data-label="Competitions">{{ s.competitions.length ? names(s) : '—' }}</td>
                <td>
                  <div class="acts">
                    <button class="btn btn-sm" (click)="openSeason(s)">Edit</button>
                    <button class="btn btn-sm" (click)="exportSeason(s)" title="Download this season's framework, layout and wording as one file">Export</button>
                    <button class="btn btn-sm" (click)="openCopy(s)" title="Start next season from this one">Copy to next</button>
                    <button class="btn btn-sm btn-danger" (click)="removeSeason(s)">Delete</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (newOpen()) {
      <div class="modal-root" (click)="newOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>New framework</h3><button class="m-x" (click)="newOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f full"><label for="nf-name">Name</label><input id="nf-name" type="text" [(ngModel)]="draft.name" maxlength="190" /></div>
            <div class="f full">
              <label for="nf-from">Start from</label>
              <select id="nf-from" [(ngModel)]="draft.cloneFrom">
                <option value="">A blank framework (with the standard IML development scale)</option>
                @for (f of frameworks(); track f.code) {
                  <option [value]="f.code">A copy of {{ f.name }} ({{ f.code }}, v{{ f.version }})</option>
                }
              </select>
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="newOpen.set(false)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || draft.name.trim().length < 3" (click)="createFramework()">{{ busy() ? 'Creating…' : 'Create draft' }}</button>
          </div>
        </div>
      </div>
    }

    @if (season(); as e) {
      <div class="modal-root" (click)="season.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ e.code ? 'Edit season ' + e.code : 'New season' }}</h3><button class="m-x" (click)="season.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f-row">
              <div class="f"><label for="se-name">Season name</label><input id="se-name" type="text" [(ngModel)]="e.name" maxlength="190" placeholder="e.g. IML 2026" /></div>
              <div class="f"><label for="se-ed">Edition label <small>(printed on the report)</small></label><input id="se-ed" type="text" [(ngModel)]="e.editionLabel" maxlength="120" placeholder="India Mind League – 1st Edition" /></div>
            </div>
            <div class="f-row">
              <div class="f">
                <label for="se-fw">Framework</label>
                <select id="se-fw" [(ngModel)]="e.frameworkCode" (ngModelChange)="onFramework(e)" [disabled]="!!e.code && e.comps.some(c => c.on)">
                  <option value="">Choose…</option>
                  @for (f of published(); track f.code) {
                    <option [value]="f.code">{{ f.name }} (v{{ f.version }})</option>
                  }
                </select>
                <div class="hint">Only published frameworks can be used.</div>
              </div>
              <div class="f">
                <label for="se-scale">Default scale</label>
                <select id="se-scale" [(ngModel)]="e.scaleKey">
                  <option value="">The framework's default</option>
                  @for (s of e.scaleOptions; track s.key) {
                    <option [value]="s.key">{{ s.name }} ({{ s.key }})</option>
                  }
                </select>
              </div>
            </div>
            <div class="f-row">
              <div class="f">
                <label for="se-lib">Content library <small>(the report wording)</small></label>
                <select id="se-lib" [(ngModel)]="e.libraryCode">
                  <option value="">None yet</option>
                  @for (l of libraries(); track l.code) {
                    <option [value]="l.code">{{ l.name }} ({{ l.code }})</option>
                  }
                </select>
                <div class="hint">Only approved wording is used in reports. Manage it under Content library.</div>
              </div>
              <div class="f">
                <label for="se-tpl">Report template <small>(the PDF layout)</small></label>
                <select id="se-tpl" [(ngModel)]="e.templateCode">
                  <option value="">None yet</option>
                  @for (t of publishedTemplates(); track t.code) {
                    <option [value]="t.code">{{ t.name }} ({{ t.code }}, v{{ t.version }})</option>
                  }
                </select>
                <div class="hint">Only published templates can be used. Manage them under Report templates.</div>
              </div>
            </div>
            <div class="sec">Releasing reports</div>
            <div class="f-row">
              <div class="f">
                <label class="chk"><input type="checkbox" [(ngModel)]="e.consentRequired" /> Parent and school need the student's consent</label>
                <label class="chk"><input type="checkbox" [(ngModel)]="e.notifyStudent" /> Tell the student when a report is released</label>
                <div class="hint">The consent wording is written under Content library (kind “Consent text”) and shown to the student.</div>
              </div>
              <div class="f">
                <label for="se-days">Parent link works for (days)</label>
                <input id="se-days" type="number" min="1" max="180" [(ngModel)]="e.linkValidDays" />
              </div>
            </div>
            <div class="f-row">
              <div class="f">
                <label for="se-pat">IML ID pattern</label>
                <input id="se-pat" type="text" [(ngModel)]="e.idPattern" maxlength="60" />
                <div class="hint">Use {{ '{YYYY}' }}, {{ '{YY}' }}, {{ '{SEASON}' }} and one running number such as {{ '{#####}' }}. Example: <code>{{ example(e) }}</code></div>
              </div>
              <div class="f">
                <label for="se-year">Year</label>
                <input id="se-year" type="number" [(ngModel)]="e.year" min="2000" max="2100" />
                <label class="chk"><input type="checkbox" [(ngModel)]="e.active" /> Active</label>
              </div>
            </div>

            <div class="sec">Competitions in this season</div>
            @if (!e.comps.length) {
              <div class="hint">No competitions found.</div>
            }
            @for (c of e.comps; track c.code) {
              <div class="comp-row" [class.off]="!!c.taken">
                <label class="chk"><input type="checkbox" [(ngModel)]="c.on" [disabled]="!!c.taken" /> <b>{{ c.title }}</b> <small>{{ c.code }} · {{ c.status }}</small></label>
                @if (c.taken) {
                  <small class="muted">Already in season {{ c.taken }}</small>
                } @else if (c.on) {
                  <select [(ngModel)]="c.scaleKey" aria-label="Scale for this competition">
                    <option value="">Use the season's scale</option>
                    @for (s of e.scaleOptions; track s.key) {
                      <option [value]="s.key">{{ s.name }} ({{ s.key }})</option>
                    }
                  </select>
                }
              </div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="season.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="saveSeason()">{{ busy() ? 'Saving…' : 'Save season' }}</button>
          </div>
        </div>
      </div>
    }

    @if (copy(); as c) {
      <div class="modal-root" (click)="copy.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Copy {{ c.from }} to a new season</h3><button class="m-x" (click)="copy.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <p class="hint">The new season uses the same published framework and report layout, so the rules stay identical. The wording is copied as <b>drafts</b> — review and approve it before reports use it. No competitions are added.</p>
            <div class="f full"><label for="cp-name">Season name</label><input id="cp-name" type="text" [(ngModel)]="c.name" maxlength="190" /></div>
            <div class="f full"><label for="cp-ed">Edition label</label><input id="cp-ed" type="text" [(ngModel)]="c.editionLabel" maxlength="120" /></div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="copy.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || c.name.trim().length < 3 || c.editionLabel.trim().length < 3" (click)="doCopy()">{{ busy() ? 'Copying…' : 'Copy season' }}</button>
          </div>
        </div>
      </div>
    }

    @if (importing(); as im) {
      <div class="modal-root" (click)="importing.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Import settings</h3><button class="m-x" (click)="importing.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <p class="hint">Choose a file exported from Scorecard setup. It is checked first; importing creates a <b>draft</b> framework, a draft report template and a content library of draft wording. Nothing is published or approved by importing.</p>
            <div class="f full"><label for="im-file">File</label><input id="im-file" type="file" accept=".json,application/json" (change)="onFile($event)" /></div>
            @if (im.check; as ck) {
              <div class="card" [class.bad]="ck.problems.length">
                <b>{{ ck.framework }}</b> · {{ ck.template || 'no report template' }} · {{ ck.libraryTexts }} wording items
                @if (ck.problems.length) {
                  <ul class="probs">@for (pr of ck.problems; track $index) { <li>{{ pr }}</li> }</ul>
                  <small>It can still be imported as a draft and fixed there.</small>
                } @else {
                  <div class="hint">No problems found.</div>
                }
              </div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="importing.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || !im.check" (click)="doImport()">{{ busy() ? 'Importing…' : 'Import as drafts' }}</button>
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
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.2rem; }
      a.link:hover { color: var(--gold-2, #f5cc5a); }
      td small.warn { color: #fda4af; }
      code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.82rem; }
      .f small { font-weight: 500; color: var(--faint, #6e7f9e); }
      .chk { display: flex; align-items: center; gap: 0.45rem; font-size: 0.88rem; cursor: pointer; margin-top: 0.5rem; }
      .chk input { width: auto; accent-color: var(--gold, #e8b64a); }
      .comp-row { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; flex-wrap: wrap; padding: 0.55rem 0.7rem; margin-bottom: 0.45rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; background: rgba(0,0,0,0.16); }
      .comp-row.off { opacity: 0.6; }
      .comp-row .chk { margin: 0; }
      .comp-row select { width: auto; min-width: 190px; padding: 0.4rem 0.6rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .muted { color: var(--faint, #6e7f9e); }
      .probs { margin: 0.5rem 0 0.4rem 1.1rem; list-style: disc; display: grid; gap: 0.2rem; font-size: 0.85rem; }
      .card.bad { border-color: rgba(251, 113, 133, 0.45); background: rgba(251, 113, 133, 0.08); }
    `,
  ],
})
export class AdminScorecardPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);
  private readonly router = inject(Router);

  protected readonly frameworks = signal<FrameworkRow[]>([]);
  protected readonly seasons = signal<SeasonRow[]>([]);
  protected readonly libraries = signal<LibraryRow[]>([]);
  protected readonly templates = signal<TemplateRow[]>([]);

  protected publishedTemplates(): TemplateRow[] {
    return this.templates().filter((t) => t.status === 'Published');
  }
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly newOpen = signal(false);
  protected readonly season = signal<SeasonEditor | null>(null);

  protected draft = { name: '', cloneFrom: '' };
  protected readonly copy = signal<{ from: string; name: string; editionLabel: string } | null>(null);
  protected readonly importing = signal<{ bundle: unknown; check: ImportCheck | null } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected published(): FrameworkRow[] {
    return this.frameworks().filter((f) => f.status === 'Published');
  }

  private load(): void {
    this.api.frameworks().subscribe({
      next: (f) => {
        this.frameworks.set(f);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
    this.api.seasons().subscribe({ next: (s) => this.seasons.set(s), error: (e) => this.error.set(errText(e)) });
    this.api.libraries().subscribe({ next: (l) => this.libraries.set(l) });
    this.api.templates().subscribe({ next: (t) => this.templates.set(t) });
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected names(s: SeasonRow): string {
    return s.competitions.map((c) => c.code).join(', ');
  }

  // ---- frameworks
  protected openNew(): void {
    this.draft = { name: '', cloneFrom: '' };
    this.modalError.set('');
    this.newOpen.set(true);
  }

  protected createFramework(): void {
    this.busy.set(true);
    this.modalError.set('');
    this.api.createFramework({ name: this.draft.name.trim(), cloneFrom: this.draft.cloneFrom || undefined }).subscribe({
      next: (f) => {
        this.busy.set(false);
        this.newOpen.set(false);
        this.router.navigate(['/admin/scorecard', f.code]);
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  // ---- seasons
  protected example(e: SeasonEditor): string {
    return idExample(e.idPattern || '', e.year ?? new Date().getFullYear(), e.code ?? 'SE1');
  }

  protected openSeason(s: SeasonRow | null): void {
    this.modalError.set('');
    this.api.competitions().subscribe({
      next: (r) => {
        const mine = new Map((s?.competitions ?? []).map((c) => [c.code, c.scaleKey ?? '']));
        const takenBy = new Map<string, string>();
        for (const other of this.seasons()) if (other.code !== s?.code) for (const c of other.competitions) takenBy.set(c.code, other.code);
        const fw = s ? s.framework.code : this.published()[0]?.code ?? '';
        const editor: SeasonEditor = {
          code: s?.code ?? null,
          name: s?.name ?? '',
          editionLabel: s?.editionLabel ?? '',
          year: s?.year ?? new Date().getFullYear(),
          idPattern: s?.idPattern ?? 'IML-{YYYY}-{#####}',
          frameworkCode: fw,
          scaleKey: s?.scaleKey ?? '',
          libraryCode: s?.library?.code ?? '',
          templateCode: s?.template?.code ?? '',
          consentRequired: s?.deliverySettings.consentRequired ?? true,
          notifyStudent: s?.deliverySettings.notifyStudent ?? true,
          linkValidDays: s?.deliverySettings.linkValidDays ?? 30,
          active: s?.active ?? true,
          scaleOptions: s?.scaleOptions ?? [],
          comps: r.data.map((c) => ({ code: c.code, title: c.title, status: c.status, on: mine.has(c.code), scaleKey: mine.get(c.code) ?? '', taken: takenBy.get(c.code) ?? null })),
        };
        this.season.set(editor);
        if (!s && fw) this.onFramework(editor);
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  // ---- governance (#87)
  protected exportSeason(s: SeasonRow): void {
    this.api.exportSeason(s.code).subscribe({
      next: (bundle) => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scorecard-' + s.code + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.flash('Exported');
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected openCopy(s: SeasonRow): void {
    this.modalError.set('');
    this.copy.set({ from: s.code, name: s.name + ' (next)', editionLabel: s.editionLabel });
  }

  protected doCopy(): void {
    const c = this.copy();
    if (!c) return;
    this.busy.set(true);
    this.modalError.set('');
    this.api.copySeason(c.from, { name: c.name.trim(), editionLabel: c.editionLabel.trim() }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.copy.set(null);
        this.flash(r.note ? 'Season ' + r.season + ' created. ' + r.note : 'Season ' + r.season + ' created');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected openImport(): void {
    this.modalError.set('');
    this.importing.set({ bundle: null, check: null });
  }

  protected onFile(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.modalError.set('');
    file.text().then(
      (text) => {
        let bundle: unknown;
        try {
          bundle = JSON.parse(text);
        } catch {
          this.importing.set({ bundle: null, check: null });
          this.modalError.set('That file is not a scorecard settings file.');
          return;
        }
        this.api.importBundle(bundle, true).subscribe({
          next: (check) => this.importing.set({ bundle, check }),
          error: (e) => {
            this.importing.set({ bundle: null, check: null });
            this.modalError.set(errText(e));
          },
        });
      },
      () => this.modalError.set('The file could not be read.'),
    );
  }

  protected doImport(): void {
    const im = this.importing();
    if (!im?.bundle) return;
    this.busy.set(true);
    this.api.importBundle(im.bundle, false).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.importing.set(null);
        const c = r.created;
        this.flash('Imported as drafts: ' + [c?.framework, c?.template, c?.library].filter(Boolean).join(', '));
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  /** Scale choices come from the chosen framework. */
  protected onFramework(e: SeasonEditor): void {
    if (!e.frameworkCode) {
      e.scaleOptions = [];
      return;
    }
    this.api.framework(e.frameworkCode).subscribe({
      next: (f) => {
        e.scaleOptions = f.config.scales.map((x) => ({ key: x.key, name: x.name }));
        if (e.scaleKey && !e.scaleOptions.some((x) => x.key === e.scaleKey)) e.scaleKey = '';
        for (const c of e.comps) if (c.scaleKey && !e.scaleOptions.some((x) => x.key === c.scaleKey)) c.scaleKey = '';
      },
    });
  }

  protected saveSeason(): void {
    const e = this.season();
    if (!e) return;
    if (e.name.trim().length < 3) return this.modalError.set('Give the season a name.');
    if (!e.editionLabel.trim()) return this.modalError.set('Enter the edition label printed on the report.');
    if (!e.frameworkCode) return this.modalError.set('Choose a published framework.');
    this.busy.set(true);
    this.modalError.set('');
    const body = {
      name: e.name.trim(),
      editionLabel: e.editionLabel.trim(),
      idPattern: e.idPattern.trim(),
      year: e.year ?? undefined,
      scaleKey: e.scaleKey,
      libraryCode: e.libraryCode,
      templateCode: e.templateCode,
      deliverySettings: { consentRequired: e.consentRequired, notifyStudent: e.notifyStudent, linkValidDays: Number(e.linkValidDays) || 30 },
      active: e.active,
    };
    const req = e.code
      ? this.api.updateSeason(e.code, { ...body, frameworkCode: e.frameworkCode })
      : this.api.createSeason({ ...body, frameworkCode: e.frameworkCode, scaleKey: e.scaleKey || undefined });
    req.subscribe({
      next: (saved) => {
        const comps = e.comps.filter((c) => c.on).map((c) => ({ competitionCode: c.code, scaleKey: c.scaleKey || undefined }));
        this.api.setSeasonCompetitions(saved.code, comps).subscribe({
          next: () => {
            this.busy.set(false);
            this.season.set(null);
            this.flash('Season saved');
            this.load();
          },
          error: (err) => {
            this.busy.set(false);
            this.modalError.set(errText(err));
            this.load();
          },
        });
      },
      error: (err) => {
        this.busy.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  protected removeSeason(s: SeasonRow): void {
    if (!confirm(`Delete season "${s.name}"?${s.competitions.length ? ' Remove its competitions first.' : ''}`)) return;
    this.api.deleteSeason(s.code).subscribe({
      next: () => {
        this.flash('Season deleted');
        this.load();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }
}

import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ADMIN_UI_CSS } from '../admin-ui';
import { LibraryRow, ReportDetail, ReportInfo, ReportList, ReportListRow, ReportPreview, ScorecardAdminApi, TemplateRow, errText } from './scorecard-admin.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <a class="back" routerLink="/admin/scorecard">← Scorecard setup</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <p class="intro">
      Generate the PDF report for each student who finished a stage. Reports are built from the stage results, the season's approved wording and its report template,
      queued, and made one at a time — never while an exam is open. Making a report again creates a new version; the earlier one stays on record and its code says it is no longer current.
    </p>

    <div class="bar">
      <select class="filter" [ngModel]="comp()" (ngModelChange)="pickCompetition($event)" aria-label="Competition">
        <option value="">Choose a competition…</option>
        @for (c of competitions(); track c.code) { <option [value]="c.code">{{ c.title }} ({{ c.code }})</option> }
      </select>
      <select class="filter" [ngModel]="stage()" (ngModelChange)="stage.set($event); load(1)" [disabled]="!stages().length" aria-label="Stage">
        <option [ngValue]="-1">Stage…</option>
        @if (stages().length > 1) { <option [ngValue]="0">Full scorecard (all stages)</option> }
        @for (s of stages(); track s.position) { <option [ngValue]="s.position">Stage {{ s.position }}: {{ s.name }}</option> }
      </select>
      <div class="grow"></div>
      <a class="btn" routerLink="/admin/scorecard/templates">Report templates</a>
    </div>

    @if (ready()) {
      @if (data(); as d) {
        <div class="stats">
          <div class="stat"><b>{{ d.summary.students }}</b><small>students finished</small></div>
          <div class="stat"><b>{{ d.summary.ready }}</b><small>reports ready</small></div>
          <div class="stat"><b>{{ d.summary.queued + d.summary.generating }}</b><small>in the queue</small></div>
          <div class="stat" [class.bad]="d.summary.failed > 0"><b>{{ d.summary.failed }}</b><small>failed</small></div>
          <div class="stat"><b>{{ d.summary.none }}</b><small>no report yet</small></div>
          <div class="stat"><b>{{ d.summary.released }}</b><small>released to students</small></div>
        </div>
        @if (d.summary.queued + d.summary.generating > 0) {
          <div class="progress" role="progressbar" [attr.aria-valuenow]="progressPct(d.summary)" aria-valuemin="0" aria-valuemax="100">
            <i [style.width.%]="progressPct(d.summary)"></i>
            <span>Making reports… {{ d.summary.ready }} of {{ d.summary.ready + d.summary.queued + d.summary.generating }} done. This page updates by itself.</span>
          </div>
        }

        <div class="bar">
          <input class="search" placeholder="Student name or code" [(ngModel)]="search" (keyup.enter)="load(1)" />
          <select class="filter" [(ngModel)]="status" (ngModelChange)="load(1)" aria-label="Status">
            <option value="">Any status</option>
            <option value="Ready">Ready</option>
            <option value="Queued">Queued</option>
            <option value="Generating">Generating</option>
            <option value="Failed">Failed</option>
            <option value="None">No report yet</option>
            <option value="Released">Released</option>
            <option value="Not released">Not released</option>
            <option value="Withdrawn">Withdrawn</option>
          </select>
          <button class="btn" (click)="load(1)">Apply</button>
          <div class="grow"></div>
          <button class="btn btn-gold" [disabled]="busy() || !d.summary.none" (click)="generateAll()">Generate {{ d.summary.none }} missing</button>
          <button class="btn" [disabled]="busy() || !d.summary.ready" (click)="regenerateAll()">Make all again</button>
        </div>
        <div class="bar">
          <button class="btn btn-gold" [disabled]="busy() || !d.summary.toRelease" (click)="releaseAll()">Release {{ d.summary.toRelease }} to students</button>
          <button class="btn" [disabled]="busy() || !d.summary.released" (click)="sendParentsAll()">Send links to parents</button>
          <button class="btn btn-danger" [disabled]="busy() || !d.summary.released" (click)="withdrawAll()">Withdraw all</button>
          <div class="grow"></div>
          <small class="muted">A report is invisible to everyone until it is released. Parents and schools also need the student's consent when the season asks for it.</small>
        </div>
        @if (outcome(); as o) {
          <div class="lock-note soft">
            <b>{{ o.title }}</b>
            @if (o.skipped.length) {
              <ul class="skips">@for (x of o.skipped; track $index) { <li><b>{{ x.student }}</b> — {{ x.reason }}</li> }</ul>
              @if (o.more) { <div>…and {{ o.more }} more.</div> }
            }
            @if (o.force.length) { <button class="btn btn-sm btn-gold" [disabled]="busy()" (click)="releaseAnyway(o.force)">Release the {{ o.force.length }} with missing wording anyway</button> }
            <button class="btn btn-sm" (click)="outcome.set(null)">Dismiss</button>
          </div>
        }

        @if (!d.rows.length) {
          <div class="card empty">No students match.</div>
        } @else {
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>Student</th><th>Report</th><th>Release</th><th>Version</th><th>Made</th><th></th></tr></thead>
              <tbody>
                @for (r of d.rows; track r.student.code) {
                  <tr>
                    <td data-label="Student"><span class="b">{{ r.student.name }}</span><small>{{ r.student.code }} · grade {{ r.student.grade }}{{ r.student.school ? ' · ' + r.student.school : '' }}</small></td>
                    <td data-label="Report">
                      @if (r.report; as x) {
                        <span class="bdg" [class.green]="x.status === 'Ready'" [class.gold]="x.status === 'Queued' || x.status === 'Generating'" [class.red]="x.status === 'Failed'">{{ x.status }}</span>
                        @if (x.status === 'Failed') { <small class="warn">{{ x.error }}</small> }
                        @if (x.gaps) { <small class="warn">{{ x.gaps }} piece(s) of wording missing</small> }
                        @if (r.pending) { <small>New version {{ r.pending.version }}: {{ r.pending.status }}</small> }
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td data-label="Release">
                      @if (r.report?.status === 'Ready') {
                        <span class="bdg" [class.green]="r.release.state === 'Released'" [class.gold]="r.release.state === 'Withdrawn'" [class.grey]="r.release.state === 'Not released'">{{ r.release.state }}</span>
                        @if (r.release.state === 'Released') { <small>v{{ r.release.version }} · {{ r.release.releasedAt | date: 'd MMM' }}</small> }
                        @if (r.release.state === 'Withdrawn' && r.release.withdrawnReason) { <small>{{ r.release.withdrawnReason }}</small> }
                        @if (r.release.awaiting) { <small class="warn">Version {{ r.release.awaiting }} awaits release</small> }
                        <small>
                          Parent: {{ r.consent.parent ? 'agreed' : 'no consent' }}@if (r.parentLink) { · link {{ r.parentLink.state }}@if (r.parentLink.openCount) { , opened {{ r.parentLink.openCount }}× } }
                          · School: {{ r.consent.school ? 'agreed' : 'no consent' }}
                        </small>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td data-label="Version">{{ r.report ? 'v' + r.report.version : '—' }}@if (r.versions > 1) { <small>{{ r.versions }} on record</small> }</td>
                    <td data-label="Made">{{ r.report?.generatedAt ? (r.report!.generatedAt | date: 'd MMM y, h:mm a') : '—' }}@if (r.report?.pages) { <small>{{ r.report!.pages }} pages · {{ kb(r.report!.sizeBytes) }}</small> }</td>
                    <td>
                      <div class="acts">
                        <button class="btn btn-sm" (click)="openPreview(r)">Preview</button>
                        @if (r.report?.status === 'Ready') {
                          <button class="btn btn-sm" (click)="download(r.report!)">Download</button>
                          <button class="btn btn-sm" (click)="openDetail(r.report!)">Details</button>
                        }
                        @if (r.report?.status === 'Ready' && (r.release.state !== 'Released' || r.release.awaiting)) { <button class="btn btn-sm btn-gold" [disabled]="busy()" (click)="releaseOne(r)">Release</button> }
                        @if (r.release.state === 'Released') {
                          <button class="btn btn-sm" [disabled]="busy() || !r.student.hasParentPhone" [title]="r.student.hasParentPhone ? '' : 'No parent phone number on record'" (click)="sendParentOne(r)">Send to parent</button>
                          <button class="btn btn-sm btn-danger" [disabled]="busy()" (click)="withdrawOne(r)">Withdraw</button>
                        }
                        @if (r.report?.status === 'Failed') { <button class="btn btn-sm" (click)="retry(r.report!)">Retry</button> }
                        @if (!r.report) { <button class="btn btn-sm btn-gold" [disabled]="busy()" (click)="generateOne(r, false)">Generate</button> }
                        @if (r.report?.status === 'Ready' && !r.pending) { <button class="btn btn-sm" [disabled]="busy()" (click)="generateOne(r, true)">Make again</button> }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (d.total > d.limit) {
            <div class="pager">
              <button class="btn btn-sm" [disabled]="d.page <= 1" (click)="load(d.page - 1)">‹ Prev</button>
              <span>Page {{ d.page }} of {{ pages(d) }}</span>
              <button class="btn btn-sm" [disabled]="d.page >= pages(d)" (click)="load(d.page + 1)">Next ›</button>
            </div>
          }
        }
      } @else if (loading()) {
        <div class="empty">Loading…</div>
      }
    } @else {
      <div class="card empty">Choose a competition and a stage to see its reports.</div>
    }

    <!-- ================================================================ preview -->
    @if (preview(); as pv) {
      <div class="modal-root" (click)="closePreview()">
        <div class="modal xwide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Preview — {{ pv.row.student.name }}</h3><button class="m-x" (click)="closePreview()" aria-label="Close">✕</button></div>
          <div class="m-body">
            <div class="f-row">
              <div class="f">
                <label for="pv-tpl">Template</label>
                <select id="pv-tpl" [(ngModel)]="pvTemplate" (ngModelChange)="reloadPreview()">
                  <option value="">The season's template</option>
                  @for (t of templates(); track t.code) { <option [value]="t.code">{{ t.name }} ({{ t.code }}, v{{ t.version }}, {{ t.status }})</option> }
                </select>
              </div>
              <div class="f">
                <label for="pv-lib">Wording</label>
                <select id="pv-lib" [(ngModel)]="pvLibrary" (ngModelChange)="reloadPreview()">
                  <option value="">The season's library</option>
                  @for (l of libraries(); track l.code) { <option [value]="l.code">{{ l.name }} ({{ l.code }})</option> }
                </select>
                <label class="chk"><input type="checkbox" [(ngModel)]="pvDraft" (ngModelChange)="reloadPreview()" /> Use draft wording too</label>
              </div>
            </div>
            @if (pvError()) { <div class="err">{{ pvError() }}</div> }
            @if (pv.data; as p) {
              @if (p.gaps.length) {
                <div class="lock-note"><b>Wording missing</b> — the report leaves these out: {{ p.gaps.join('; ') }}.</div>
              }
              @if (p.fallbacks.length) {
                <div class="lock-note soft">Default wording is used for: {{ p.fallbacks.join('; ') }}.</div>
              }
              @if (!p.gaps.length && !p.fallbacks.length) {
                <div class="ok-note">All the wording this template asks for is written.</div>
              }
              <div class="paper"><iframe class="sheet" title="Report preview" sandbox="allow-same-origin" [srcdoc]="html()" (load)="fit($event)"></iframe></div>
              <small class="muted">This is a screen preview of the layout. The PDF has A4 page breaks, page numbers and the verification QR code.</small>
            } @else if (!pvError()) {
              <div class="empty">Building the preview…</div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closePreview()">Close</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="previewPdf()">{{ busy() ? 'Preparing…' : 'Open PDF preview' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- ================================================================ details -->
    @if (detail(); as x) {
      <div class="modal-root" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Report {{ x.code }}</h3><button class="m-x" (click)="detail.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            <div class="kvs">
              <div><small>Student</small><b>{{ x.student.name }}</b> <span class="muted">{{ x.student.code }}</span></div>
              <div><small>Version</small><b>{{ x.version }}</b> @if (x.superseded) { <span class="bdg grey">replaced by a newer version</span> } @else { <span class="bdg green">current</span> }</div>
              <div><small>Made</small>{{ x.generatedAt | date: 'd MMM y, h:mm a' }}@if (x.requestedByName) { <span class="muted"> · asked by {{ x.requestedByName }}</span> }</div>
              <div><small>File</small>{{ x.pages }} pages · {{ kb(x.sizeBytes) }}</div>
              <div class="wide-row"><small>SHA-256 checksum</small><code>{{ x.checksum }}</code></div>
            </div>
            @if (x.configUsed; as c) {
              <div class="sec">Built from</div>
              <ul class="used">
                <li>Framework {{ c.framework?.code }} version {{ c.framework?.version }}, scale {{ c.scale }}</li>
                <li>Template {{ c.template?.code }} version {{ c.template?.version }}</li>
                <li>Wording library {{ c.library?.code }} ({{ c.library?.language }}) — {{ c.texts?.length ?? 0 }} approved pieces used</li>
                @if (c.season) { <li>Season {{ c.season }}</li> }
                @if (c.attempt) { <li>Attempt {{ c.attempt }}</li> }
              </ul>
            }
            @if (x.warnings?.gaps?.length) { <div class="lock-note">Wording that was missing: {{ x.warnings!.gaps!.join('; ') }}.</div> }
            <div class="sec">Versions</div>
            @for (v of x.versions; track v.id) {
              <div class="ver">
                <b>v{{ v.version }}</b> <code>{{ v.code }}</code>
                <span class="bdg" [class.green]="v.status === 'Ready' && !v.superseded" [class.grey]="v.superseded">{{ v.superseded ? 'replaced' : v.status }}</span>
                @if (v.status === 'Ready') { <button class="btn btn-sm" (click)="downloadId(v.id, x.student.code, v.version)">Download</button> }
              </div>
            }
          </div>
          <div class="m-foot"><button class="btn" (click)="detail.set(null)">Close</button></div>
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
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.1rem; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.7rem; margin-bottom: 1rem; }
      .stat.bad b { color: #fda4af; }
      td small { display: block; color: var(--faint, #6e7f9e); }
      td small.warn { color: #fda4af; }
      .muted { color: var(--faint, #6e7f9e); }
      .progress { position: relative; height: 30px; border-radius: 10px; background: rgba(255,255,255,0.07); overflow: hidden; margin-bottom: 1rem; }
      .progress i { position: absolute; inset: 0 auto 0 0; background: rgba(232, 182, 74, 0.35); transition: width 0.4s; }
      .progress span { position: relative; display: block; padding: 0.4rem 0.8rem; font-size: 0.82rem; }
      .pager { display: flex; justify-content: center; align-items: center; gap: 0.8rem; margin: 1rem 0; font-size: 0.85rem; }
      .modal.xwide { width: min(980px, 100%); }
      .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin: 0.6rem 0; }
      .lock-note.soft { background: rgba(96, 165, 250, 0.1); border-color: rgba(96, 165, 250, 0.4); color: #93c5fd; }
      .ok-note { background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.4); color: #6ee7b7; padding: 0.5rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin: 0.6rem 0; }
      .paper { background: #3b4658; padding: 1rem; border-radius: 12px; overflow: auto; max-height: 62vh; margin-top: 0.6rem; }
      .sheet { display: block; border: 0; background: #fff; width: 794px; max-width: none; height: 1123px; margin: 0 auto; box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
      .chk { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; cursor: pointer; margin-top: 0.5rem; }
      .chk input { width: auto; accent-color: var(--gold, #e8b64a); }
      .kvs { display: grid; gap: 0.6rem; }
      .kvs small { display: block; color: var(--faint, #6e7f9e); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
      .kvs code, .ver code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.8rem; word-break: break-all; }
      .used { margin: 0.3rem 0 0.8rem 1.1rem; padding: 0; list-style: disc; display: grid; gap: 0.25rem; font-size: 0.88rem; }
      .skips { margin: 0.4rem 0; padding-left: 1.1rem; list-style: disc; display: grid; gap: 0.2rem; }
      .ver { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding: 0.45rem 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.07)); }
    `,
  ],
})
export class AdminReportsPage implements OnInit, OnDestroy {
  private readonly api = inject(ScorecardAdminApi);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly competitions = signal<{ code: string; title: string; status: string }[]>([]);
  protected readonly stages = signal<{ position: number; name: string; mode: string }[]>([]);
  protected readonly templates = signal<TemplateRow[]>([]);
  protected readonly libraries = signal<LibraryRow[]>([]);
  protected readonly comp = signal('');
  protected readonly stage = signal(-1);
  protected readonly data = signal<ReportList | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly preview = signal<{ row: ReportListRow; data: ReportPreview | null } | null>(null);
  protected readonly html = signal<SafeHtml>('');
  protected readonly pvError = signal('');
  protected readonly detail = signal<ReportDetail | null>(null);
  protected readonly outcome = signal<{ title: string; skipped: { student: string; reason: string }[]; more: number; force: string[] } | null>(null);

  protected search = '';
  protected status = '';
  protected pvTemplate = '';
  protected pvLibrary = '';
  protected pvDraft = false;
  private page = 1;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.api.competitions().subscribe({ next: (r) => this.competitions.set(r.data), error: (e) => this.error.set(errText(e)) });
    this.api.templates().subscribe({ next: (t) => this.templates.set(t) });
    this.api.libraries().subscribe({ next: (l) => this.libraries.set(l) });
    // keep the list fresh while reports are being made
    this.timer = setInterval(() => {
      const s = this.data()?.summary;
      if (s && s.queued + s.generating > 0 && !this.loading()) this.load(this.page, true);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected ready(): boolean {
    return !!this.comp() && this.stage() >= 0;
  }

  protected pickCompetition(code: string): void {
    this.comp.set(code);
    this.stage.set(-1);
    this.data.set(null);
    this.stages.set([]);
    this.error.set('');
    if (!code) return;
    this.api.stages(code).subscribe({
      next: (s) => {
        this.stages.set(s);
        if (s.length === 1) {
          this.stage.set(s[0].position);
          this.load(1);
        }
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected load(page: number, quiet = false): void {
    if (!this.ready()) return;
    this.page = page;
    if (!quiet) this.loading.set(true);
    this.api.reports(this.comp(), this.stage(), { search: this.search.trim(), status: this.status, page }).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        if (!quiet) this.error.set('');
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected pages(d: ReportList): number {
    return Math.max(1, Math.ceil(d.total / d.limit));
  }

  protected progressPct(s: ReportList['summary']): number {
    const total = s.ready + s.queued + s.generating;
    return total ? Math.round((s.ready / total) * 100) : 0;
  }

  protected kb(n: number | null): string {
    return n === null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 3200);
  }

  // ------------------------------------------------------------- generating
  private generate(body: { students?: string[]; regenerate?: boolean }, done: (r: { queued: number; requeued: number; skipped: number }) => string): void {
    this.busy.set(true);
    this.error.set('');
    this.api.generateReports(this.comp(), this.stage(), body).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.flash(done(r));
        this.load(this.page, true);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  protected generateAll(): void {
    this.generate({}, (r) => `${r.queued + r.requeued} report(s) queued`);
  }

  protected regenerateAll(): void {
    if (!confirm('Make every report again? Each student gets a new version; the earlier PDFs stay on record but their codes will say they are not the current version.')) return;
    this.generate({ regenerate: true }, (r) => `${r.queued} new version(s) queued`);
  }

  protected generateOne(r: ReportListRow, again: boolean): void {
    if (again && !confirm(`Make ${r.student.name}'s report again? The current PDF stays on record as an earlier version.`)) return;
    this.generate({ students: [r.student.code], regenerate: again }, () => 'Queued');
  }

  // ---------------------------------------------------- release and delivery
  private done(title: string, skipped: { student: string; reason: string }[], count: number): void {
    const force = skipped.filter((x) => /Wording is missing/.test(x.reason)).map((x) => x.student);
    this.outcome.set({ title, skipped, more: Math.max(0, count - skipped.length), force });
    this.load(this.page, true);
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(errText(e));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private release(students: string[] | undefined, force: boolean): void {
    this.busy.set(true);
    this.error.set('');
    this.api.releaseReports(this.comp(), { stage: this.stage(), students, force }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.done(`${r.released} report(s) released${r.notified ? `; ${r.notified} student(s) told` : ''}.`, r.skipped, r.skippedCount);
      },
      error: (e) => this.fail(e),
    });
  }

  protected releaseAll(): void {
    if (!confirm('Release these reports? Students can then see and download them (and are told by message when the season says so). Parents and schools see them only if the student has agreed.')) return;
    this.release(undefined, false);
  }

  protected releaseAnyway(students: string[]): void {
    if (!confirm('These reports are missing some wording, so they leave those parts out. Release them anyway?')) return;
    this.release(students, true);
  }

  protected releaseOne(r: ReportListRow): void {
    if (!confirm(`Release ${r.student.name}'s report? They can then see and download it.`)) return;
    this.release([r.student.code], false);
  }

  private withdraw(students: string[] | undefined, what: string): void {
    const reason = prompt(`Why is ${what} being withdrawn? (kept on record)`, '');
    if (reason === null) return;
    this.busy.set(true);
    this.error.set('');
    this.api.withdrawReports(this.comp(), { stage: this.stage(), students, reason: reason.trim() || undefined }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.done(`${r.withdrawn} report(s) withdrawn; ${r.linksRevoked} parent link(s) switched off.`, [], 0);
      },
      error: (e) => this.fail(e),
    });
  }

  protected withdrawAll(): void {
    if (!confirm('Withdraw every released report of this stage? Nobody can open them until they are released again, and parent links stop working.')) return;
    this.withdraw(undefined, 'these reports');
  }

  protected withdrawOne(r: ReportListRow): void {
    this.withdraw([r.student.code], `${r.student.name}'s report`);
  }

  private sendParents(students: string[] | undefined): void {
    this.busy.set(true);
    this.error.set('');
    this.api.sendReportsToParents(this.comp(), { stage: this.stage(), students }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.done(`${r.sent} link(s) sent to parents by SMS.`, r.skipped, r.skippedCount);
      },
      error: (e) => this.fail(e),
    });
  }

  protected sendParentsAll(): void {
    if (!confirm('Send each parent a link and a code by SMS? Only released reports of students who agreed and have a parent phone number are sent. An earlier link for the same report stops working.')) return;
    this.sendParents(undefined);
  }

  protected sendParentOne(r: ReportListRow): void {
    this.sendParents([r.student.code]);
  }

  protected retry(x: ReportInfo): void {
    this.api.retryReport(x.id).subscribe({
      next: () => {
        this.flash('Back in the queue');
        this.load(this.page, true);
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected download(x: ReportInfo): void {
    const row = this.data()?.rows.find((r) => r.report?.id === x.id);
    this.downloadId(x.id, row?.student.code ?? 'report', x.version);
  }

  protected downloadId(id: number, studentCode: string, version: number): void {
    this.api.openPdf(`/scorecard/reports/${id}/download`, {}, this.stage() === 0 ? `${studentCode}-scorecard-v${version}.pdf` : `${studentCode}-stage-${this.stage()}-v${version}.pdf`, true).subscribe({ error: (e) => this.error.set(errText(e)) });
  }

  protected openDetail(x: ReportInfo): void {
    this.api.report(x.id).subscribe({ next: (d) => this.detail.set(d), error: (e) => this.error.set(errText(e)) });
  }

  // ---------------------------------------------------------------- preview
  protected openPreview(r: ReportListRow): void {
    this.pvTemplate = '';
    this.pvLibrary = '';
    this.pvDraft = false;
    this.preview.set({ row: r, data: null });
    this.reloadPreview();
  }

  protected closePreview(): void {
    this.preview.set(null);
    this.pvError.set('');
  }

  protected reloadPreview(): void {
    const pv = this.preview();
    if (!pv) return;
    this.pvError.set('');
    this.preview.set({ row: pv.row, data: null });
    this.api
      .reportPreview({ comp: this.comp(), stage: this.stage(), student: pv.row.student.code, template: this.pvTemplate, library: this.pvLibrary, draft: this.pvDraft })
      .subscribe({
        next: (d) => {
          // Shown in an isolated frame (no scripts), so the report's own styles cannot touch this page.
          const padded = d.html.replace('</head>', '<style>body{padding:57px}</style></head>');
          this.html.set(this.sanitizer.bypassSecurityTrustHtml(padded));
          this.preview.set({ row: pv.row, data: d });
        },
        error: (e) => this.pvError.set(errText(e)),
      });
  }

  /** Grows the frame to the report's height so the sheet scrolls as one page. */
  protected fit(ev: Event): void {
    const f = ev.target as HTMLIFrameElement;
    const h = f.contentDocument?.documentElement.scrollHeight;
    if (h) f.style.height = `${h}px`;
  }

  protected previewPdf(): void {
    const pv = this.preview();
    if (!pv) return;
    this.busy.set(true);
    this.api
      .openPdf('/scorecard/reports/preview.pdf', { comp: this.comp(), stage: this.stage(), student: pv.row.student.code, template: this.pvTemplate, library: this.pvLibrary, draft: this.pvDraft ? 'true' : undefined }, 'preview.pdf', false)
      .subscribe({
        next: () => this.busy.set(false),
        error: (e) => {
          this.busy.set(false);
          this.pvError.set(errText(e));
        },
      });
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { ScorecardAdminApi } from '../scorecard/scorecard-admin.service';
import { Control, ControlStudent, Panelist, PanelApi, PanelFormRow, StageStatus, StudentDetail, errText } from '../../panel/panel-api.service';

type Tab = 'stage' | 'panelists';

interface SelectionPreview {
  stage: { name: string; passMark: number; maxQualifiers: number | null };
  cap: number | null;
  eligibleCount: number;
  autoPicked: { studentCode: string; studentName: string; percent: number; rank?: number; levelKey: string | null }[];
  ineligible: { studentCode: string; studentName: string; percent: number | null; rank?: number }[];
  notRated?: { studentCode: string; studentName: string }[];
  mode?: string;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (error()) { <div class="err">{{ error() }}</div> }
    <p class="intro">
      Panel-rated stages (offline, hybrid, peer interview): set up the panel and the evaluation form, then open the stage for rating, watch who is missing ratings,
      close it, decide any disagreements, finalize the result and run the selection. One stage of a competition is open at a time, and the next stage opens only after the
      previous one is closed with its selection committed.
    </p>
    <div class="tabs" role="tablist">
      <button class="tab" [class.on]="tab() === 'stage'" (click)="tab.set('stage')">Stage control</button>
      <button class="tab" [class.on]="tab() === 'panelists'" (click)="openPanelists()">Panelists</button>
    </div>

    @if (tab() === 'panelists') {
      <div class="bar">
        <input class="search" placeholder="Search panelists" [(ngModel)]="search" (keyup.enter)="loadPanelists()" />
        <div class="grow"></div>
        <button class="btn btn-gold" (click)="newPanelist.set({ name: '', email: '', phone: '' })">+ Invite a panelist</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Panelist</th><th>Status</th><th>Contact</th><th>Stages</th><th></th></tr></thead>
          <tbody>
            @for (p of panelists(); track p.id) {
              <tr>
                <td data-label="Panelist"><span class="b">{{ p.name }}</span><small>{{ p.code }}</small></td>
                <td data-label="Status"><span class="bdg" [class.green]="p.status === 'Active'" [class.gold]="p.status === 'Invited'" [class.grey]="p.status === 'Disabled'">{{ p.status }}</span>@if (p.lastLoginAt) { <small>last sign-in {{ p.lastLoginAt | date: 'd MMM, h:mm a' }}</small> }</td>
                <td data-label="Contact">{{ p.email }}<small>{{ p.phone || '' }}</small></td>
                <td data-label="Stages">{{ p.enrolments }}</td>
                <td>
                  <div class="acts">
                    @if (p.status !== 'Disabled') { <button class="btn btn-sm" (click)="pAct(p, 'resend')">{{ p.hasPassword ? 'Send reset link' : 'Resend invite' }}</button> }
                    @if (p.status !== 'Disabled') { <button class="btn btn-sm" (click)="pAct(p, 'disable')">Disable</button> } @else { <button class="btn btn-sm" (click)="pAct(p, 'enable')">Enable</button> }
                    <button class="btn btn-sm btn-danger" (click)="pRemove(p)">Remove</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">No panelists yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="bar">
        <select class="filter" [ngModel]="comp()" (ngModelChange)="pickComp($event)" aria-label="Competition">
          <option value="">Choose a competition…</option>
          @for (c of competitions(); track c.code) { <option [value]="c.code">{{ c.title }} ({{ c.code }})</option> }
        </select>
        <select class="filter" [ngModel]="stage()" (ngModelChange)="stage.set($event); load()" [disabled]="!stages().length" aria-label="Stage">
          <option [ngValue]="0">Stage…</option>
          @for (s of stages(); track s.position) { <option [ngValue]="s.position">Stage {{ s.position }}: {{ s.name }} ({{ s.mode }})</option> }
        </select>
      </div>

      @if (ctl(); as c) {
        <div class="card">
          <div class="state-row">
            <span class="bdg big" [class.green]="c.state === 'Open'" [class.gold]="c.state === 'Draft' || c.state === 'Ready'" [class.grey]="c.state === 'Closed' || c.state === 'Finalized'" [class.purple]="c.state === 'Selected' || c.state === 'Released'">{{ c.state }}</span>
            <b>Stage {{ c.stage.position }}: {{ c.stage.name }}</b>
            <small class="muted">pass mark {{ c.stage.passMark }}%{{ c.stage.maxQualifiers ? ', up to ' + c.stage.maxQualifiers + ' qualify' : '' }} · {{ c.rosterSize }} students in the roster</small>
          </div>

          @if (c.state === 'Draft' || c.state === 'Ready') {
            <div class="f-row" style="margin-top:0.8rem">
              <div class="f">
                <label for="ps-form">Evaluation form</label>
                <select id="ps-form" [ngModel]="c.form?.code ?? ''" (ngModelChange)="setup({ formCode: $event })">
                  <option value="">Choose a form…</option>
                  @for (f of forms(); track f.code) { <option [value]="f.code" [disabled]="f.status !== 'Published'">{{ f.title }} ({{ f.code }}, {{ f.status }}, {{ f.competencies }} competencies)</option> }
                </select>
                <div class="hint"><a routerLink="/admin/assessments">Build forms under Assessments</a>; only published forms can be used.</div>
              </div>
              <div class="f"><label for="ps-raters">Raters needed per student</label><input id="ps-raters" type="number" min="1" max="9" [ngModel]="c.requiredRaters" (change)="setup({ requiredRaters: +$any($event.target).value })" /></div>
            </div>
          } @else {
            <p class="muted" style="margin:0.6rem 0 0">Form: {{ c.form?.title }} ({{ c.form?.code }}) · {{ c.requiredRaters }} raters per student. The form is frozen from the moment the stage opened.</p>
          }

          <div class="sec">Panel</div>
          @for (p of c.panelists; track p.panelistId) {
            <div class="chip-row">
              <b>{{ p.name }}</b> <small class="muted">{{ p.email }}{{ p.conflictSchools.length ? ' · conflicts: ' + p.conflictSchools.join(', ') : '' }}</small>
              <span class="bdg" [class.green]="p.status === 'Active'" [class.gold]="p.status === 'Invited'" [class.grey]="p.status === 'Disabled'">{{ p.status }}</span>
              @if (c.state === 'Draft' || c.state === 'Ready' || c.state === 'Open') { <button class="btn btn-sm" (click)="unenrol(p.panelistId)">Remove</button> }
            </div>
          } @empty {
            <p class="muted" style="margin:0">Nobody yet.</p>
          }
          @if (c.state === 'Draft' || c.state === 'Ready' || c.state === 'Open') {
            <div class="enrol">
              <select [(ngModel)]="enrolId" aria-label="Panelist to add">
                <option [ngValue]="0">Add a panelist…</option>
                @for (p of freePanelists(); track p.id) { <option [ngValue]="p.id">{{ p.name }} ({{ p.email }})</option> }
              </select>
              <input type="text" [(ngModel)]="enrolConflicts" placeholder="School ids to avoid (optional, comma separated)" aria-label="Conflict school ids" />
              <button class="btn btn-sm btn-gold" [disabled]="!enrolId || busy()" (click)="enrol()">Add</button>
            </div>
          }

          <div class="sec">Stage controls</div>
          @if (c.state === 'Draft' && c.readyIssues.length) {
            <div class="checklist"><b>To get this stage ready:</b><ul>@for (i of c.readyIssues; track $index) { <li>{{ i }}</li> }</ul></div>
          }
          @if (c.state !== 'Open' && c.openBlockers.length && (c.state === 'Draft' || c.state === 'Ready')) {
            <div class="checklist warn"><b>Why it cannot be opened yet:</b><ul>@for (i of c.openBlockers; track $index) { <li>{{ i }}</li> }</ul></div>
          }
          <div class="acts big-acts">
            @if (c.state === 'Draft' || c.state === 'Ready') { <button class="btn btn-gold" [disabled]="busy() || !c.canOpen" [title]="c.openBlockers.join(' ')" (click)="life('open')">Open for rating</button> }
            @if (c.state === 'Open') { <button class="btn btn-gold" [disabled]="busy()" (click)="close()">Close the stage</button> }
            @if (c.state === 'Closed') { <button class="btn btn-gold" [disabled]="busy()" (click)="finalize(false)">Finalize results</button> }
            @if (c.state === 'Finalized') { <button class="btn btn-gold" [disabled]="busy()" (click)="openSelection()">Selection…</button> }
            @if (c.state === 'Selected') { <button class="btn btn-gold" [disabled]="busy()" (click)="life('release')">Release the results to reports</button> }
            @if (c.state === 'Closed' || c.state === 'Finalized') { <button class="btn" [disabled]="busy()" (click)="override()">Administrator override (send back a step)</button> }
            @if (c.state === 'Open') { <button class="btn" [disabled]="busy()" (click)="remind(undefined)">Remind panelists</button> }
            @if (c.state !== 'Draft' && c.state !== 'Ready') { <button class="btn" (click)="exportXlsx()">Export to Excel</button> }
          </div>
        </div>

        @if (c.state !== 'Draft' && c.state !== 'Ready') {
          <div class="stats">
            <div class="stat"><b>{{ c.summary.students }}</b><small>students</small></div>
            <div class="stat"><b>{{ c.summary.rated }}</b><small>fully rated</small></div>
            <div class="stat" [class.bad]="c.summary.missing > 0"><b>{{ c.summary.missing }}</b><small>missing ratings</small></div>
            <div class="stat" [class.bad]="c.summary.flagged > 0"><b>{{ c.summary.flagged }}</b><small>disagreements</small></div>
          </div>

          <div class="sec">Panelists' progress</div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>Panelist</th><th>Submitted</th><th>Drafts</th><th>Not started</th><th></th></tr></thead>
              <tbody>
                @for (p of c.panelistProgress; track p.panelistId) {
                  <tr>
                    <td data-label="Panelist"><span class="b">{{ p.name }}</span><small>{{ p.status }}</small></td>
                    <td data-label="Submitted">{{ p.submitted }} of {{ p.assigned }}</td>
                    <td data-label="Drafts">{{ p.drafts }}</td>
                    <td data-label="Not started">{{ p.notStarted }}</td>
                    <td>@if (c.state === 'Open' && p.drafts + p.notStarted > 0) { <button class="btn btn-sm" (click)="remind(p.panelistId)">Remind</button> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="sec">Students</div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>Student</th><th>Ratings</th><th>Average</th><th>Score</th><th>Level</th><th>Flags</th><th></th></tr></thead>
              <tbody>
                @for (s of c.students; track s.registrationId) {
                  <tr [class.warnrow]="s.status !== 'Rated'">
                    <td data-label="Student"><span class="b">{{ s.name }}</span><small>{{ s.code }}{{ s.school ? ' · ' + s.school : '' }}</small></td>
                    <td data-label="Ratings">{{ s.submitted }} of {{ s.required }}@if (s.drafts) { <small>{{ s.drafts }} draft</small> }</td>
                    <td data-label="Average">{{ s.average ?? '—' }}</td>
                    <td data-label="Score">{{ s.percent === null ? '—' : s.percent + '%' }}</td>
                    <td data-label="Level">{{ s.levelLabel ?? 'Not rated' }}</td>
                    <td data-label="Flags">@if (s.flagged) { <span class="bdg red">Disagree</span> } @if (s.adjudicated) { <span class="bdg purple">Decided</span> }</td>
                    <td><button class="btn btn-sm" (click)="openStudent(s)">Details</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else if (loading()) {
        <div class="empty">Loading…</div>
      } @else {
        <div class="card empty">Choose a competition and a stage.</div>
      }
    }

    @if (newPanelist(); as np) {
      <div class="modal-root" (click)="newPanelist.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Invite a panelist</h3><button class="m-x" (click)="newPanelist.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f full"><label for="np-n">Name</label><input id="np-n" type="text" [(ngModel)]="np.name" maxlength="120" /></div>
            <div class="f full"><label for="np-e">Email</label><input id="np-e" type="email" [(ngModel)]="np.email" /></div>
            <div class="f full"><label for="np-p">Phone (for SMS)</label><input id="np-p" type="text" [(ngModel)]="np.phone" /></div>
            <div class="hint">They get an email and SMS with a link to set their own password.</div>
          </div>
          <div class="m-foot"><button class="btn" (click)="newPanelist.set(null)">Cancel</button><button class="btn btn-gold" [disabled]="busy() || np.name.trim().length < 2 || !np.email.trim()" (click)="invite(np)">Send invite</button></div>
        </div>
      </div>
    }

    @if (detail(); as d) {
      <div class="modal-root" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ d.student.name }} — ratings</h3><button class="m-x" (click)="detail.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="tbl-wrap">
              <table class="mini">
                <thead><tr><th>Competency</th>@for (r of d.ratings; track r.id) { <th>{{ r.panelist }}<br /><small>{{ r.status }}</small></th> }<th>Combined</th>@if (canDecide()) { <th>Decide</th> }</tr></thead>
                <tbody>
                  @for (c of d.result.competencies; track c.code) {
                    <tr [class.warnrow]="c.flagged">
                      <td>{{ c.label }}@if (c.flagged) { <span class="bdg red">Disagree</span> }</td>
                      @for (r of d.ratings; track r.id) { <td>{{ r.ratings[c.code]?.points ?? '—' }}@if (r.ratings[c.code]?.comment) { <small class="muted"> “{{ r.ratings[c.code]!.comment }}”</small> }</td> }
                      <td><b>{{ c.final ?? '—' }}</b>@if (c.adjudicated) { <small> (decided)</small> }</td>
                      @if (canDecide()) { <td><input type="number" min="0" max="10" style="width:64px" [ngModel]="decide[c.code]" (ngModelChange)="decide[c.code] = $event" aria-label="Decided points" /></td> }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @for (r of d.ratings; track r.id) { @if (r.note) { <p class="muted"><b>{{ r.panelist }}:</b> {{ r.note }}</p> } }
            @if (d.adjudication) { <p class="muted">Decided by {{ d.adjudication.decidedByName }}: {{ d.adjudication.reason }}</p> }
            @if (canDecide()) {
              <div class="f full"><label for="dd-r">Reason for the decision</label><input id="dd-r" type="text" [(ngModel)]="decideReason" maxlength="500" placeholder="Why these points?" /></div>
            }
            @if (c()?.state === 'Open') {
              <div class="sec">Reopen a submitted rating</div>
              @for (r of d.ratings; track r.id) { @if (r.status === 'Submitted') { <button class="btn btn-sm" (click)="reopen(r.id)">Send {{ r.panelist }}'s rating back as a draft</button> } }
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="detail.set(null)">Close</button>
            @if (canDecide()) { <button class="btn btn-gold" [disabled]="busy()" (click)="adjudicate(d)">Save the decision</button> }
          </div>
        </div>
      </div>
    }

    @if (sel(); as s) {
      <div class="modal-root" (click)="sel.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Selection — {{ s.stage.name }}</h3><button class="m-x" (click)="sel.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <p class="muted">Ranked by the stage score, highest first. {{ s.cap ? 'The top ' + s.cap + ' qualify.' : 'Everyone at or above the pass mark qualifies.' }} Students who were not rated are not selected and are left as they are.</p>
            <div class="sec">Qualify ({{ s.autoPicked.length }})</div>
            @for (r of s.autoPicked; track r.studentCode) { <div class="chip-row">#{{ r.rank }} <b>{{ r.studentName }}</b> <small class="muted">{{ r.studentCode }} · {{ r.percent }}% {{ r.levelKey || '' }}</small></div> }
            <div class="sec">Not selected ({{ s.ineligible.length }})</div>
            @for (r of s.ineligible; track r.studentCode) { <div class="chip-row"><b>{{ r.studentName }}</b> <small class="muted">{{ r.studentCode }} · {{ r.percent }}%</small></div> }
            @if (s.notRated?.length) { <div class="sec">Not rated ({{ s.notRated!.length }})</div> @for (r of s.notRated!; track r.studentCode) { <div class="chip-row"><b>{{ r.studentName }}</b> <small class="muted">{{ r.studentCode }}</small></div> } }
          </div>
          <div class="m-foot"><button class="btn" (click)="sel.set(null)">Close</button><button class="btn btn-gold" [disabled]="busy()" (click)="commit()">Commit this selection</button></div>
        </div>
      </div>
    }
    @if (toast()) { <div class="toast">{{ toast() }}</div> }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 90ch; margin: 0 0 1.1rem; }
      .tabs { display: flex; flex-wrap: wrap; width: 100%; margin-bottom: 1rem; }
      .tab { flex: 1 1 auto; }
      .muted { color: var(--muted, #9fb0d0); font-size: 0.85rem; }
      td small { display: block; color: var(--faint, #6e7f9e); }
      .state-row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
      .bdg.big { font-size: 0.85rem; padding: 0.3rem 0.8rem; }
      .chip-row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; padding: 0.4rem 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.07)); }
      .enrol { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.7rem; }
      .enrol select, .enrol input { flex: 1 1 200px; }
      .checklist { background: rgba(232,182,74,0.1); border: 1px solid rgba(232,182,74,0.4); border-radius: 12px; padding: 0.7rem 0.9rem; margin-bottom: 0.7rem; font-size: 0.88rem; }
      .checklist.warn { background: rgba(251,113,133,0.08); border-color: rgba(251,113,133,0.4); }
      .checklist ul { margin: 0.3rem 0 0 1.1rem; padding: 0; list-style: disc; display: grid; gap: 0.2rem; }
      .big-acts { gap: 0.6rem; flex-wrap: wrap; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.7rem; margin: 1rem 0; }
      .stat.bad b { color: #fda4af; }
      .warnrow td { background: rgba(251,113,133,0.05); }
      table.mini small { color: var(--faint, #6e7f9e); }
    `,
  ],
})
export class AdminPanelPage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly sc = inject(ScorecardAdminApi);

  protected readonly tab = signal<Tab>('stage');
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly competitions = signal<{ code: string; title: string }[]>([]);
  protected readonly stages = signal<{ position: number; name: string; mode: string }[]>([]);
  protected readonly comp = signal('');
  protected readonly stage = signal(0);
  protected readonly ctl = signal<Control | null>(null);
  protected readonly forms = signal<PanelFormRow[]>([]);
  protected readonly panelists = signal<Panelist[]>([]);
  protected readonly newPanelist = signal<{ name: string; email: string; phone: string } | null>(null);
  protected readonly detail = signal<StudentDetail | null>(null);
  protected readonly sel = signal<SelectionPreview | null>(null);
  protected search = '';
  protected enrolId = 0;
  protected enrolConflicts = '';
  protected decide: Record<string, number | null> = {};
  protected decideReason = '';

  ngOnInit(): void {
    this.sc.competitions().subscribe({ next: (r) => this.competitions.set(r.data), error: (e) => this.error.set(errText(e)) });
    this.api.forms().subscribe({ next: (f) => this.forms.set(f) });
    this.api.panelists().subscribe({ next: (p) => this.panelists.set(p) });
  }

  protected c(): Control | null {
    return this.ctl();
  }

  private flash(m: string): void {
    this.toast.set(m);
    setTimeout(() => this.toast() === m && this.toast.set(''), 3000);
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(errText(e));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----------------------------------------------------------------- panelists
  protected openPanelists(): void {
    this.tab.set('panelists');
    this.loadPanelists();
  }

  protected loadPanelists(): void {
    this.api.panelists(this.search.trim()).subscribe({ next: (p) => this.panelists.set(p), error: (e) => this.error.set(errText(e)) });
  }

  protected invite(np: { name: string; email: string; phone: string }): void {
    this.busy.set(true);
    this.modalError.set('');
    this.api.createPanelist({ name: np.name.trim(), email: np.email.trim(), phone: np.phone.trim() || undefined }).subscribe({
      next: () => {
        this.busy.set(false);
        this.newPanelist.set(null);
        this.flash('Invitation sent');
        this.loadPanelists();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected pAct(p: Panelist, action: 'resend' | 'disable' | 'enable'): void {
    this.api.panelistAction(p.id, action).subscribe({
      next: () => {
        this.flash(action === 'resend' ? 'Link sent' : action === 'disable' ? 'Disabled' : 'Enabled');
        this.loadPanelists();
      },
      error: (e) => this.fail(e),
    });
  }

  protected pRemove(p: Panelist): void {
    if (!confirm(`Remove ${p.name}? A panelist with ratings on record is kept (disable them instead).`)) return;
    this.api.deletePanelist(p.id).subscribe({ next: () => this.loadPanelists(), error: (e) => this.fail(e) });
  }

  protected freePanelists(): Panelist[] {
    const on = new Set(this.ctl()?.panelists.map((p) => p.panelistId) ?? []);
    return this.panelists().filter((p) => p.status !== 'Disabled' && !on.has(p.id));
  }

  // --------------------------------------------------------------------- stages
  protected pickComp(code: string): void {
    this.comp.set(code);
    this.stage.set(0);
    this.ctl.set(null);
    this.stages.set([]);
    if (!code) return;
    this.sc.stages(code).subscribe({ next: (s) => this.stages.set(s), error: (e) => this.error.set(errText(e)) });
  }

  protected load(): void {
    if (!this.comp() || !this.stage()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.control(this.comp(), this.stage()).subscribe({
      next: (c) => {
        this.ctl.set(c);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errText(e));
      },
    });
  }

  private apply(): void {
    this.busy.set(false);
    this.load();
  }

  protected setup(body: { formCode?: string; requiredRaters?: number }): void {
    this.api.setup(this.comp(), this.stage(), body).subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }

  protected enrol(): void {
    const conflicts = this.enrolConflicts.split(/[,\s]+/).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
    this.busy.set(true);
    this.api.enrol(this.comp(), this.stage(), this.enrolId, conflicts).subscribe({
      next: () => {
        this.enrolId = 0;
        this.enrolConflicts = '';
        this.apply();
      },
      error: (e) => this.fail(e),
    });
  }

  protected unenrol(panelistId: number): void {
    this.api.unenrol(this.comp(), this.stage(), panelistId).subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }

  protected life(action: 'open' | 'release'): void {
    if (action === 'open' && !confirm('Open this stage for rating? The evaluation form is frozen from now on.')) return;
    this.busy.set(true);
    this.api.lifecycle(this.comp(), this.stage(), action).subscribe({
      next: () => {
        this.flash(action === 'open' ? 'Stage opened' : 'Released');
        this.apply();
      },
      error: (e) => this.fail(e),
    });
  }

  protected close(): void {
    this.busy.set(true);
    this.api.lifecycle(this.comp(), this.stage(), 'close', {}).subscribe({
      next: () => {
        this.flash('Stage closed');
        this.apply();
      },
      error: (e) => {
        this.busy.set(false);
        const warnings = (e?.error?.warnings as string[] | undefined) ?? [];
        if (warnings.length && confirm(`${warnings.join('\n')}\n\nClose the stage anyway?`)) {
          this.busy.set(true);
          this.api.lifecycle(this.comp(), this.stage(), 'close', { confirm: true }).subscribe({ next: () => { this.flash('Stage closed'); this.apply(); }, error: (e2) => this.fail(e2) });
        } else if (!warnings.length) this.fail(e);
      },
    });
  }

  protected finalize(force: boolean): void {
    this.busy.set(true);
    this.api.lifecycle(this.comp(), this.stage(), 'finalize', { force }).subscribe({
      next: () => {
        this.flash('Results finalized');
        this.apply();
      },
      error: (e) => {
        this.busy.set(false);
        if (e?.error?.flagged && confirm(`${errText(e)}\n\nFinalize anyway?`)) this.finalize(true);
        else this.fail(e);
      },
    });
  }

  protected override(): void {
    const reason = prompt('Why are you sending this stage back a step? This is recorded in the audit log.', '');
    if (!reason) return;
    this.busy.set(true);
    this.api.lifecycle(this.comp(), this.stage(), 'override', { reason }).subscribe({
      next: () => {
        this.flash('Stage sent back');
        this.apply();
      },
      error: (e) => this.fail(e),
    });
  }

  protected remind(panelistId: number | undefined): void {
    this.api.remind(this.comp(), this.stage(), panelistId).subscribe({ next: (r) => this.flash(`${r.sent} reminder(s) sent`), error: (e) => this.fail(e) });
  }

  protected exportXlsx(): void {
    this.api.exportXlsx(this.comp(), this.stage()).subscribe({ error: (e) => this.fail(e) });
  }

  // ------------------------------------------------------------- student detail
  protected canDecide(): boolean {
    return this.ctl()?.state === 'Closed';
  }

  protected openStudent(s: ControlStudent): void {
    this.modalError.set('');
    this.api.studentDetail(this.comp(), this.stage(), s.registrationId).subscribe({
      next: (d) => {
        this.decide = Object.fromEntries(d.result.competencies.map((c) => [c.code, c.adjudicated ? c.final : null]));
        this.decideReason = '';
        this.detail.set(d);
      },
      error: (e) => this.fail(e),
    });
  }

  protected adjudicate(d: StudentDetail): void {
    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.decide)) if (v !== null && v !== undefined && `${v}` !== '') overrides[k] = Number(v);
    this.busy.set(true);
    this.modalError.set('');
    this.api.adjudicate(this.comp(), this.stage(), d.student.registrationId, overrides, this.decideReason.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.detail.set(null);
        this.flash('Decision saved');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected reopen(id: number): void {
    const reason = prompt('Why is this rating being reopened? (recorded)', '');
    if (!reason) return;
    this.api.reopenRating(id, reason).subscribe({
      next: () => {
        this.detail.set(null);
        this.flash('Rating reopened');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  // ------------------------------------------------------------------ selection
  protected openSelection(): void {
    const c = this.ctl();
    if (!c) return;
    this.modalError.set('');
    this.api.selectionPreview(this.comp(), c.stage.id).subscribe({ next: (p) => this.sel.set(p as unknown as SelectionPreview), error: (e) => this.fail(e) });
  }

  protected commit(): void {
    const c = this.ctl();
    if (!c || !confirm('Commit this selection? It is applied once and cannot be undone. Students are notified.')) return;
    this.busy.set(true);
    this.api.selectionCommit(this.comp(), c.stage.id).subscribe({
      next: (r) => {
        this.sel.set(null);
        this.flash(`${r.qualified} qualified, ${r.eliminated} not selected`);
        this.apply();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }
}

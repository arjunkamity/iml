import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface CompRow {
  code: string;
  title: string;
  grades: string;
  startDate: string;
  endDate: string;
  status: string;
  isMulti: boolean;
  registrations: number;
  stages: number;
}

interface ListResult {
  data: CompRow[];
  total: number;
  page: number;
  limit: number;
}

interface CompForm {
  title: string;
  grades: string;
  status: string;
  startDate: string;
  endDate: string;
  isMulti: boolean;
  description: string;
}

interface Stage {
  id: number;
  position: number;
  name: string;
  mode: string;
  passMark: number;
  isFree: boolean;
  price: number;
  description: string | null;
}

interface Qualifier {
  status: string;
  score: number | null;
  qualified: boolean | null;
  unlockedAt: string | null;
  paidAt: string | null;
  stage: { position: number; name: string };
  registration: {
    code: string;
    status: string;
    student: { name: string; code: string; grade: string; school?: { name?: string } | null };
  };
}

interface GradeRow {
  name: string;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-competitions',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (mgr) {
      <!-- competition detail -->
      <div class="bar">
        <button class="btn btn-sm" (click)="closeDetail()">&#8592; Back to competitions</button>
        <div class="grow"></div>
        <span class="bdg grey">{{ mgr.code }}</span>
        <span class="bdg" [class]="'bdg ' + statusBadge(mgr.status)">{{ mgr.status }}</span>
      </div>

      <div class="grid g4" style="margin-bottom:1rem">
        <div class="card">
          <div style="font-weight:800;font-size:1.02rem">{{ mgr.title }}</div>
          <small style="display:block;color:var(--muted, #9fb0d0)">Grades {{ mgr.grades || '—' }} &middot; {{ mgr.isMulti ? 'Multi-stage' : 'Single stage' }}</small>
          <div style="margin-top:0.6rem"><span class="bdg blue">{{ mgr.registrations }} registered</span> <span class="bdg gold">{{ mgr.stages }} stages</span></div>
        </div>
        <div class="card stat"><b>{{ slice(mgr.startDate) }}</b><small>Start date</small></div>
        <div class="card stat"><b>{{ slice(mgr.endDate) }}</b><small>End date</small></div>
        <div class="card stat"><b>{{ mgr.registrations }}</b><small>Registrations</small></div>
      </div>

      <div class="tabs">
        <button class="tab" [class.on]="mgrTab === 'stages'" (click)="mgrTab = 'stages'">Stages ({{ stages().length }})</button>
        <button class="tab" [class.on]="mgrTab === 'qual'" (click)="mgrTab = 'qual'; loadQual()">Qualifiers</button>
      </div>

      @if (mgrTab === 'stages') {
        <div class="bar">
          <span style="font-size:0.82rem;color:var(--muted, #9fb0d0)">Stages in order; add/edit to shape the journey.</span>
          <div class="grow"></div>
          <button class="btn btn-gold btn-sm" (click)="openStage()">+ Stage</button>
        </div>

        @if (stageFormOpen) {
          <div class="card" style="margin-bottom:1rem;max-width:720px">
            <div style="font-weight:800;font-size:1.02rem;margin-bottom:0.9rem">{{ editingStage ? 'Edit stage' : 'Add stage' }}</div>
            @if (stageErr) {
              <div class="err">{{ stageErr }}</div>
            }
            <div class="grid g2" style="margin-bottom:0.8rem">
              <div class="f"><label>Position</label><input type="number" [(ngModel)]="sf.position" /></div>
              <div class="f"><label>Pass mark %</label><input type="number" step="0.1" [(ngModel)]="sf.passMark" /></div>
            </div>
            <div class="f"><label>Name</label><input [(ngModel)]="sf.name" /></div>
            <div class="f">
              <label>Mode</label>
              <select [(ngModel)]="sf.mode">
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Peer Interview">Peer Interview</option>
              </select>
            </div>
            <div class="mods" style="margin-bottom:0.9rem">
              <label class="chk"><input type="checkbox" [(ngModel)]="sf.isFree" /> Free stage</label>
            </div>
            <div class="f"><label>Price (paid stage)</label><input type="number" step="0.01" [(ngModel)]="sf.price" /></div>
            <div class="f"><label>Description</label><textarea [(ngModel)]="sf.description" rows="3"></textarea></div>
            <div class="bar" style="margin:0.6rem 0 0">
              <button class="btn" (click)="stageFormOpen = false">Cancel</button>
              <button class="btn btn-gold" (click)="saveStage()">{{ editingStage ? 'Save' : 'Add' }}</button>
            </div>
          </div>
        }

        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Pos</th><th>Stage</th><th>Mode</th><th>Pass</th><th>Free</th><th>Price</th><th></th></tr></thead>
            <tbody>
              @for (s of stages(); track s.id) {
                <tr>
                  <td>{{ s.position }}</td>
                  <td><span class="b">{{ s.name }}</span></td>
                  <td>{{ s.mode }}</td>
                  <td>{{ s.passMark }}%</td>
                  <td>{{ s.isFree ? 'Yes' : 'No' }}</td>
                  <td>{{ s.price }}</td>
                  <td>
                    <div class="acts">
                      <button class="btn btn-sm" (click)="openStage(s)">Edit</button>
                      <button class="btn btn-sm btn-danger" (click)="removeStage(s)">Delete</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty">No stages yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (mgrTab === 'qual') {
        <div class="bar">
          <select class="filter" [(ngModel)]="qualStage" (ngModelChange)="loadQual()">
            <option [ngValue]="null">All stages</option>
            @for (s of stages(); track s.id) {
              <option [ngValue]="s.position">Stage {{ s.position }} — {{ s.name }}</option>
            }
          </select>
          <div class="grow"></div>
          <span style="font-size:0.82rem;color:var(--muted, #9fb0d0)">{{ quals().length }} rows</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Student</th><th>Stage</th><th>Score</th><th>Qualified</th><th>Status</th></tr></thead>
            <tbody>
              @for (q of quals(); track $index) {
                <tr>
                  <td><span class="b">{{ q.registration.student.name }}</span><small>{{ q.registration.student.grade }}</small></td>
                  <td>St{{ q.stage.position }} — {{ q.stage.name }}</td>
                  <td>{{ q.score ?? '—' }}</td>
                  <td>
                    @if (q.qualified === true) { <span class="bdg green">Yes</span> }
                    @else if (q.qualified === false) { <span class="bdg red">No</span> }
                    @else { <span class="bdg grey">—</span> }
                  </td>
                  <td><span class="bdg" [class]="'bdg ' + qualBadge(q.status)">{{ q.status }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">No qualifier rows yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (formOpen) {
      <!-- create / edit competition -->
      <div class="bar">
        <button class="btn btn-sm" (click)="formOpen = false">&#8592; Back to competitions</button>
      </div>
      <div class="card" style="max-width:720px">
        <div style="font-weight:800;font-size:1.05rem;margin-bottom:0.9rem">{{ editing ? 'Edit competition' : 'New competition' }}</div>
        @if (modalError) {
          <div class="err">{{ modalError }}</div>
        }
        <div class="f">
          <label>Title</label>
          <input [(ngModel)]="form.title" />
        </div>
        <div class="grid g2" style="margin-bottom:0.8rem">
          <div class="f">
            <label>Grades</label>
            <select [(ngModel)]="form.grades">
              <option value="">—</option>
              @for (g of gradeOptions(); track g) {
                <option [value]="g">{{ g }}</option>
              }
            </select>
          </div>
          <div class="f">
            <label>Status</label>
            <select [(ngModel)]="form.status">
              <option value="Draft">Draft</option>
              <option value="Open">Open</option>
              <option value="Live">Live</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <div class="grid g2" style="margin-bottom:0.8rem">
          <div class="f"><label>Start date</label><input type="date" [(ngModel)]="form.startDate" /></div>
          <div class="f"><label>End date</label><input type="date" [(ngModel)]="form.endDate" /></div>
        </div>
        <div class="mods" style="margin-bottom:0.9rem">
          <label class="chk"><input type="checkbox" [(ngModel)]="form.isMulti" /> Multi-stage competition</label>
        </div>
        <div class="f">
          <label>Description</label>
          <textarea [(ngModel)]="form.description" rows="3"></textarea>
        </div>
        <div class="bar" style="margin:0.6rem 0 0">
          <button class="btn" (click)="formOpen = false">Cancel</button>
          <button class="btn btn-gold" (click)="save()">{{ editing ? 'Save' : 'Create' }}</button>
        </div>
      </div>
    } @else {
      <!-- list -->
      <div class="bar">
        <select class="filter" [(ngModel)]="status" (ngModelChange)="go(1)">
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Open">Open</option>
          <option value="Live">Live</option>
          <option value="Closed">Closed</option>
        </select>
        <input class="search" placeholder="Search title / code…" [(ngModel)]="search" (keyup.enter)="go(1)" />
        <div class="grow"></div>
        <button class="btn btn-gold" (click)="openCreate()">+ Competition</button>
      </div>

      @if (error) {
        <div class="err">{{ error }}</div>
      }

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>Code</th><th>Title</th><th>Grades</th><th>Dates</th><th>Status</th><th>Stages</th><th>Regs</th><th></th></tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.code) {
              <tr>
                <td>{{ c.code }}</td>
                <td><span class="b">{{ c.title }}</span></td>
                <td>{{ c.grades }}</td>
                <td>{{ slice(c.startDate) }} → {{ slice(c.endDate) }}</td>
                <td><span class="bdg" [class]="'bdg ' + statusBadge(c.status)">{{ c.status }}</span></td>
                <td>{{ c.stages }}</td>
                <td>{{ c.registrations }}</td>
                <td>
                  <div class="acts">
                    <button class="btn btn-sm" (click)="manage(c)">Stages &amp; qualifiers</button>
                    <button class="btn btn-sm" (click)="openEdit(c)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="remove(c)">Delete</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">No competitions yet.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (total() > 0) {
        <div class="pager">
          <span>{{ ((page() - 1) * 10 + 1) }}–{{ min(page() * 10, total()) }} of {{ total() }}</span>
          <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
          <button class="btn btn-sm" [disabled]="page() * 10 >= total()" (click)="go(page() + 1)">Next →</button>
        </div>
      }
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminCompetitionsPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<CompRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly stages = signal<Stage[]>([]);
  readonly quals = signal<Qualifier[]>([]);
  readonly gradeOptions = signal<string[]>([]);
  search = '';
  status = '';
  error = '';
  formOpen = false;
  editing = false;
  editingCode = '';
  modalError = '';
  mgr: CompRow | null = null;
  mgrTab: 'stages' | 'qual' = 'stages';
  qualStage: number | null = null;
  stageFormOpen = false;
  editingStage = false;
  stageId: number | null = null;
  stageErr = '';
  form: CompForm = { title: '', grades: '', status: 'Draft', startDate: '', endDate: '', isMulti: false, description: '' };

  constructor() {
    this.loadGrades();
    this.load();
  }

  loadGrades() {
    this.api.get<{ data: GradeRow[] }>('/grades', { limit: 100 }).subscribe({
      next: (r) => {
        const opts = (r.data ?? [])
          .map((g) => g.name)
          .filter(Boolean)
          .sort();
        this.gradeOptions.set(opts);
      },
      error: () => this.gradeOptions.set([]),
    });
  }

  min(a: number, b: number) {
    return Math.min(a, b);
  }

  slice(v: string) {
    return typeof v === 'string' ? v.slice(0, 10) : '';
  }

  statusBadge(s: string) {
    return { Draft: 'grey', Open: 'blue', Live: 'green', Closed: 'red' }[s] ?? 'grey';
  }

  qualBadge(s: string) {
    return { Locked: 'grey', Paid: 'blue', Attempted: 'purple', Qualified: 'green', Eliminated: 'red' }[s] ?? 'grey';
  }

  load() {
    this.error = '';
    const p: Record<string, unknown> = { page: this.page(), limit: 10 };
    if (this.status) p['status'] = this.status;
    if (this.search.trim()) p['search'] = this.search.trim();
    this.api.get<ListResult>('/competitions', p).subscribe({
      next: (r) => {
        this.rows.set(r.data ?? []);
        this.total.set(r.total ?? 0);
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  closeDetail() {
    this.mgr = null;
  }

  openCreate() {
    this.form = { title: '', grades: '', status: 'Draft', startDate: '', endDate: '', isMulti: false, description: '' };
    this.editing = false;
    this.editingCode = '';
    this.modalError = '';
    this.formOpen = true;
  }

  openEdit(c: CompRow) {
    this.form = {
      title: c.title,
      grades: c.grades,
      status: c.status,
      startDate: this.slice(c.startDate),
      endDate: this.slice(c.endDate),
      isMulti: c.isMulti,
      description: '',
    };
    this.editing = true;
    this.editingCode = c.code;
    this.modalError = '';
    this.formOpen = true;
  }

  save() {
    this.modalError = '';
    const body = {
      title: this.form['title'],
      grades: this.form['grades'],
      status: this.form['status'],
      startDate: this.form['startDate'],
      endDate: this.form['endDate'],
      isMulti: this.form['isMulti'],
      description: this.form['description'] || undefined,
    };
    const req = this.editing
      ? this.api.patch(`/competitions/${this.editingCode}`, body)
      : this.api.post('/competitions', body);
    req.subscribe({
      next: () => {
        this.formOpen = false;
        this.load();
      },
      error: (e) => {
        this.modalError = errText(e);
      },
    });
  }

  remove(c: CompRow) {
    if (!confirm(`Delete competition ${c.code} — ${c.title}? This also removes its stages, questions, prizes.`)) return;
    this.api.delete(`/competitions/${c.code}`).subscribe({
      next: () => this.load(),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  manage(c: CompRow) {
    this.mgr = c;
    this.mgrTab = 'stages';
    this.qualStage = null;
    this.stageFormOpen = false;
    this.loadStages();
  }

  loadStages() {
    if (!this.mgr) return;
    this.api.get<Stage[]>(`/competitions/${this.mgr.code}/stages`).subscribe({
      next: (r) => this.stages.set(Array.isArray(r) ? r : []),
      error: () => this.stages.set([]),
    });
  }

  loadQual() {
    if (!this.mgr) return;
    const p: Record<string, unknown> = {};
    if (this.qualStage != null) p['stage'] = this.qualStage;
    this.api.get<Qualifier[]>(`/competitions/${this.mgr.code}/qualifiers`, p).subscribe({
      next: (r) => this.quals.set(Array.isArray(r) ? r : []),
      error: () => this.quals.set([]),
    });
  }

  sf: { position: number; name: string; mode: string; passMark: number; isFree: boolean; price: number; description: string } = {
    position: 1,
    name: '',
    mode: 'Online',
    passMark: 40,
    isFree: true,
    price: 0,
    description: '',
  };

  openStage(s?: Stage) {
    this.stageErr = '';
    if (s) {
      this.editingStage = true;
      this.stageId = s.id;
      this.sf = {
        position: s.position,
        name: s.name,
        mode: s.mode,
        passMark: Number(s.passMark),
        isFree: s.isFree,
        price: Number(s.price),
        description: s.description ?? '',
      };
    } else {
      this.editingStage = false;
      this.stageId = null;
      const nextPos = this.stages().length ? Math.max(...this.stages().map((x) => x.position)) + 1 : 1;
      this.sf = { position: nextPos, name: '', mode: 'Online', passMark: 40, isFree: true, price: 0, description: '' };
    }
    this.stageFormOpen = true;
  }

  saveStage() {
    if (!this.mgr) return;
    this.stageErr = '';
    const body = {
      position: Number(this.sf.position),
      name: this.sf.name,
      mode: this.sf.mode,
      passMark: Number(this.sf.passMark),
      isFree: this.sf.isFree,
      price: Number(this.sf.price),
      description: this.sf.description || undefined,
    };
    const req = this.editingStage
      ? this.api.patch(`/competitions/${this.mgr.code}/stages/${this.stageId}`, body)
      : this.api.post(`/competitions/${this.mgr.code}/stages`, body);
    req.subscribe({
      next: () => {
        this.stageFormOpen = false;
        this.loadStages();
      },
      error: (e) => {
        this.stageErr = errText(e);
      },
    });
  }

  removeStage(s: Stage) {
    if (!this.mgr) return;
    if (!confirm(`Delete stage ${s.position} — ${s.name}? This also removes its rules, attempts and payments.`)) return;
    this.api.delete(`/competitions/${this.mgr.code}/stages/${s.id}`).subscribe({
      next: () => this.loadStages(),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }
}

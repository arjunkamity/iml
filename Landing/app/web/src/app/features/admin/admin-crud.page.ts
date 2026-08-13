import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';
import { CRUD_MODULES, CrudConfig, FieldDef } from './crud.config';

type Row = Record<string, unknown>;

interface ListResult {
  data: Row[];
  total: number;
  page: number;
  limit: number;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

function isoDate(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, 10);
}

@Component({
  selector: 'app-admin-crud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bar">
      @if (cfg.search !== false) {
        <input class="search" placeholder="Search…" [(ngModel)]="search" (keyup.enter)="applySearch()" />
      }
      @for (f of cfg.filters ?? []; track f.key) {
        <select class="filter" [ngModel]="filters[f.key] ?? ''" (ngModelChange)="setFilter(f.key, $event)">
          <option value="">All {{ f.label }}</option>
          @for (opt of filterOptions(f); track opt) {
            <option [value]="opt">{{ opt }}</option>
          }
        </select>
      }
      <div class="grow"></div>
      @if (cfg.canCreate) {
        <button class="btn btn-gold" (click)="openCreate()">+ {{ cfg.createText ?? 'Add' }}</button>
      }
    </div>

    @if (error) {
      <div class="err">{{ error }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            @for (c of cfg.columns; track c.key) {
              <th>{{ c.label }}</th>
            }
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row[cfg.keyField ?? 'code']) {
            <tr>
              @for (c of cfg.columns; track c.key) {
                <td>
                  @switch (c.type) {
                    @case ('badge') {
                      <span class="bdg" [ngClass]="badgeClass(c, row[c.key])">{{ row[c.key] ?? '—' }}</span>
                    }
                    @case ('date') {
                      {{ row[c.key] ? isoDate(row[c.key]) : '—' }}
                    }
                    @case ('datetime') {
                      {{ row[c.key] ? datetime(row[c.key]) : '—' }}
                    }
                    @case ('time') {
                      {{ row[c.key] ? timeStr(row[c.key]) : '—' }}
                    }
                    @case ('money') {
                      ₹{{ row[c.key] ?? '—' }}
                    }
                    @case ('array') {
                      {{ arrayText(row[c.key]) }}
                    }
                    @case ('boolean') {
                      <span class="bdg" [ngClass]="row[c.key] ? 'green' : 'grey'">{{ row[c.key] ? 'Yes' : 'No' }}</span>
                    }
                    @default {
                      <span class="b">{{ row[c.key] ?? '—' }}</span>
                    }
                  }
                </td>
              }
              <td>
                <div class="acts">
                  @if (cfg.canView) {
                    <button class="btn btn-sm" (click)="view(row)">View</button>
                  }
                  @if (cfg.profile) {
                    <button class="btn btn-sm" (click)="openEditProfile(row)">Edit Profile</button>
                  }
                  @if (cfg.canEdit) {
                    <button class="btn btn-sm" (click)="openEdit(row)">Edit</button>
                  }
                  @if (cfg.canDelete) {
                    <button class="btn btn-sm btn-danger" (click)="remove(row)">Delete</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td [attr.colspan]="cfg.columns.length + 1" class="empty">No records found.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (cfg.paginated !== false && total() > 0) {
      <div class="pager">
        <span>{{ ((page() - 1) * limit + 1) }}–{{ min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }

    @if (modalOpen) {
      <div class="modal-root" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ editMode === 'profile' ? (cfg.profile?.title ?? 'Edit Profile') : (editing ? 'Edit' : 'Add') }} {{ editMode === 'profile' ? '' : cfg.title.slice(0, -1) }}</h3>
            <button class="m-x" (click)="closeModal()">✕</button>
          </div>
          <div class="m-body">
            @if (modalError) {
              <div class="err">{{ modalError }}</div>
            }
            <div class="f-row">
              @for (f of formFields(); track f.key) {
                <div class="f" [ngClass]="{ col: f.col, full: true }">
                  <label>{{ f.label }}@if (f.required) { * }</label>
                  @switch (f.type) {
                    @case ('select') {
                      <select [(ngModel)]="form[f.key]">
                        <option value="">—</option>
                        @for (opt of fieldOptions(f); track opt) {
                          <option [value]="opt">{{ opt }}</option>
                        }
                      </select>
                    }
                    @case ('textarea') {
                      <textarea [(ngModel)]="form[f.key]" [rows]="f.rows ?? 3"></textarea>
                    }
                    @case ('checkbox') {
                      <input type="checkbox" [(ngModel)]="form[f.key]" />
                    }
                    @case ('date') {
                      <input type="date" [(ngModel)]="form[f.key]" />
                    }
                    @case ('time') {
                      <div class="time-pick">
                        <select [ngModel]="timeParts(f.key).h" (ngModelChange)="setTime(f.key, 'h', $event)">
                          @for (h of timeHours(f.key); track h) {
                            <option [value]="h">{{ h }}</option>
                          }
                        </select>
                        <span class="tsep">:</span>
                        <select [ngModel]="timeParts(f.key).m" (ngModelChange)="setTime(f.key, 'm', $event)">
                          @for (m of timeMinutes(); track m) {
                            <option [value]="m">{{ m }}</option>
                          }
                        </select>
                        <select class="ap" [ngModel]="timeParts(f.key).ap" (ngModelChange)="setTime(f.key, 'ap', $event)">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    }
                    @case ('number') {
                      <input type="number" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                    @case ('password') {
                      <input type="password" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                    @case ('lines') {
                      <textarea [(ngModel)]="form[f.key]" rows="4" [placeholder]="f.placeholder ?? 'One per line'"></textarea>
                    }
                    @case ('indices') {
                      <textarea [(ngModel)]="form[f.key]" rows="2" [placeholder]="f.placeholder ?? '0 or 1,2'"></textarea>
                    }
                    @default {
                      <input [type]="f.type === 'email' ? 'email' : 'text'" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                  }
                  @if (f.help) {
                    <div class="hint">{{ f.help }}</div>
                  }
                </div>
              }
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeModal()">Cancel</button>
            <button class="btn btn-gold" [disabled]="saving" (click)="submit()">
              {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (viewOpen) {
      <div class="modal-root" (click)="closeView()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ viewTitle }}</h3>
            <button class="m-x" (click)="closeView()">✕</button>
          </div>
          <div class="m-body">
            @if (viewError) {
              <div class="err">{{ viewError }}</div>
            }
            @if (viewData) {
              <dl class="dl">
                @for (f of viewFields(); track f.key) {
                  <dt>{{ f.label }}</dt>
                  <dd>{{ f.value }}</dd>
                }
              </dl>
              @if (students().length) {
                <h4 class="sec">Students</h4>
                <table class="mini">
                  <thead><tr><th>Code</th><th>Name</th><th>Grade</th><th>Reg</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (st of students(); track st['id']) {
                      <tr>
                        <td>{{ st['code'] }}</td>
                        <td class="b">{{ st['name'] }}</td>
                        <td>{{ st['grade'] }}</td>
                        <td>{{ studentRegs(st) }}</td>
                        <td>{{ studentStatus(st) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              @if (payments().length) {
                <h4 class="sec">Payments</h4>
                <table class="mini">
                  <thead><tr><th>Code</th><th>Stage</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (p of payments(); track p['id']) {
                      <tr>
                        <td>{{ p['code'] }}</td>
                        <td>{{ stageName(p) }}</td>
                        <td>₹{{ p['amount'] }}</td>
                        <td>{{ p['mode'] }}</td>
                        <td><span class="bdg" [ngClass]="badgeClass({ badgeMap: { Paid: 'green', Pending: 'gold', Failed: 'red' } }, p['status'])">{{ p['status'] }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            } @else {
              <div class="empty">Loading…</div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeView()">Close</button>
          </div>
        </div>
      </div>
    }

    @if (toast) {
      <div class="toast">{{ toast }}</div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminCrudPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly cfg: CrudConfig;
  private readonly refs = new Map<string, string[]>();

  readonly rows = signal<Row[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 15;
  search = '';
  filters: Record<string, string> = {};
  error = '';

  modalOpen = false;
  editing = false;
  saving = false;
  modalError = '';
  editingKey = '';
  form: Record<string, unknown> = {};
  toast = '';

  viewOpen = false;
  viewData: Row | null = null;
  viewError = '';
  viewTitle = '';
  editMode: 'main' | 'profile' = 'main';

  constructor() {
    const mod = (this.route.snapshot.data['mod'] as string) ?? '';
    this.cfg = CRUD_MODULES[mod] ?? CRUD_MODULES['ann'];
    this.loadRefs();
    this.load();
  }

  min(a: number, b: number) {
    return Math.min(a, b);
  }

  isoDate(v: unknown) {
    return isoDate(v);
  }

  datetime(v: unknown) {
    if (typeof v !== 'string') return '';
    return `${v.slice(0, 10)} ${v.slice(11, 16)}`;
  }

  timeStr(v: unknown) {
    if (typeof v !== 'string') return '';
    const m = v.match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  }

  timeParts(key: string) {
    const v = typeof this.form[key] === 'string' ? (this.form[key] as string) : '';
    const m = v.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return { h: '8', m: '00', ap: 'AM' };
    const h24 = Number(m[1]);
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { h: String(h12), m: m[2], ap };
  }

  timeHours(key: string) {
    return this.timeParts(key).ap === 'AM' ? ['8', '9', '10', '11'] : ['12', '1', '2', '3', '4', '5', '6'];
  }

  timeMinutes() {
    return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  }

  setTime(key: string, part: 'h' | 'm' | 'ap', value: string) {
    const t = this.timeParts(key);
    if (part === 'h') t.h = value;
    else if (part === 'm') t.m = value;
    else t.ap = value;
    let h24 = Number(t.h) % 12;
    if (t.ap === 'PM') h24 += 12;
    this.form[key] = `${String(h24).padStart(2, '0')}:${t.m}`;
  }

  arrayText(v: unknown) {
    return Array.isArray(v) ? v.join(', ') : '';
  }

  badgeClass(c: { badgeMap?: Record<string, string> }, value: unknown) {
    const map = c.badgeMap ?? {};
    return map[String(value)] ?? 'grey';
  }

  filterOptions(f: { options?: string[]; ref?: 'competitions' | 'grades' }) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    if (f.ref === 'grades') return this.refs.get('grades') ?? [];
    return f.options ?? [];
  }

  fieldOptions(f: FieldDef) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    if (f.ref === 'schools') return this.refs.get('schools') ?? [];
    if (f.ref === 'registrations') return this.refs.get('registrations') ?? [];
    if (f.ref === 'grades') return this.refs.get('grades') ?? [];
    return f.options ?? [];
  }

  formFields(): FieldDef[] {
    const fields = this.editMode === 'profile' ? (this.cfg.profile?.fields ?? []) : this.cfg.fields;
    if (!this.editing) return fields.filter((f) => f.type !== 'password' || !f.editOnly);
    return fields.filter((f) => !(f.type === 'password' && f.editOnly));
  }

  applySearch() {
    this.page.set(1);
    this.load();
  }

  setFilter(key: string, value: string) {
    this.filters[key] = value;
    this.page.set(1);
    this.load();
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  private params(): Record<string, unknown> {
    const p: Record<string, unknown> = { page: this.page(), limit: this.limit };
    if (this.search.trim()) p['search'] = this.search.trim();
    for (const [k, v] of Object.entries(this.filters)) {
      if (v) p[k] = v;
    }
    return p;
  }

  private loadRefs() {
    const wanted = new Set<string>();
    for (const f of this.cfg.fields ?? []) if (f.ref) wanted.add(f.ref);
    for (const f of this.cfg.profile?.fields ?? []) if (f.ref) wanted.add(f.ref);
    for (const f of this.cfg.filters ?? []) if (f.ref) wanted.add(f.ref);
    if (wanted.has('competitions')) {
      this.api.get<ListResult>('/competitions', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((c) => `${c['code']}`).sort();
          this.refs.set('competitions', opts);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('schools')) {
      this.api.get<ListResult>('/schools', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((s) => `${s['code']} — ${s['name']}`);
          this.refs.set('schools', opts);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('registrations')) {
      this.api.get<ListResult>('/registrations', { limit: 500 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((x) => `${x['code']} — ${x['name']}`);
          this.refs.set('registrations', opts);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('grades')) {
      this.api.get<ListResult>('/grades', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? [])
            .map((g) => `${g['name']}`)
            .filter(Boolean)
            .sort();
          this.refs.set('grades', opts);
        },
        error: () => undefined,
      });
    }
  }

  private load() {
    this.error = '';
    const obs = (this.cfg.paginated === false
      ? this.api.get<Row[]>(this.cfg.base, this.params())
      : this.api.get<ListResult>(this.cfg.base, this.params())) as Observable<
      Row[] | ListResult
    >;
    obs.subscribe({
      next: (r) => {
        if (Array.isArray(r)) {
          this.rows.set(r as Row[]);
          this.total.set((r as Row[]).length);
        } else {
          const res = r as ListResult;
          this.rows.set(res.data ?? []);
          this.total.set(res.total ?? 0);
        }
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  private resetForm(fields?: FieldDef[]) {
    const list = fields ?? this.cfg.fields;
    this.form = {};
    for (const f of list) {
      if (f.type === 'checkbox') this.form[f.key] = false;
      else if (f.type === 'lines' || f.type === 'indices') this.form[f.key] = '';
      else this.form[f.key] = f.type === 'select' ? '' : '';
    }
  }

  openCreate() {
    this.editMode = 'main';
    this.resetForm();
    this.editing = false;
    this.editingKey = '';
    this.modalError = '';
    this.modalOpen = true;
  }

  openEdit(row: Row) {
    this.editMode = 'main';
    this.resetForm();
    this.editing = true;
    this.editingKey = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    for (const f of this.cfg.fields) {
      const v = row[f.key];
      if (f.type === 'date') this.form[f.key] = isoDate(v);
      else if (f.type === 'time') this.form[f.key] = this.timeStr(v);
      else if (f.type === 'lines') this.form[f.key] = Array.isArray(v) ? v.join('\n') : '';
      else if (f.type === 'indices') this.form[f.key] = Array.isArray(v) ? v.join(',') : '';
      else if (f.type === 'number') this.form[f.key] = v;
      else if (f.type === 'checkbox') this.form[f.key] = !!v;
      else this.form[f.key] = v ?? '';
    }
    this.modalError = '';
    this.modalOpen = true;
  }

  openEditProfile(row: Row) {
    if (!this.cfg.profile) return;
    this.editMode = 'profile';
    this.resetForm(this.cfg.profile.fields);
    this.editing = true;
    this.editingKey = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.modalError = '';
    this.modalOpen = true;
    this.api.get<Row>(`${this.cfg.profile.base}/${this.editingKey}`).subscribe({
      next: (s) => {
        for (const f of this.cfg.profile?.fields ?? []) {
          let v: unknown = s[f.key];
          if (f.key === 'schoolCode') {
            const school = s['school'] as { code?: string } | null | undefined;
            v = school?.code ?? '';
          }
          if (f.type === 'date') this.form[f.key] = isoDate(v);
          else if (f.type === 'number') this.form[f.key] = v;
          else if (f.type === 'checkbox') this.form[f.key] = !!v;
          else this.form[f.key] = v ?? '';
        }
      },
      error: (e) => {
        this.modalError = errText(e);
      },
    });
  }

  closeModal() {
    if (this.saving) return;
    this.modalOpen = false;
  }

  private payload(): Record<string, unknown> {
    const fields = this.editMode === 'profile' ? (this.cfg.profile?.fields ?? []) : this.cfg.fields;
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = this.form[f.key];
      if (f.editOnly && (v === '' || v == null)) continue;
      let val: unknown = v;
      if (f.type === 'number') val = v === '' ? undefined : Number(v);
      else if (f.type === 'lines') {
        val = typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [];
      } else if (f.type === 'indices') {
        val = typeof v === 'string'
          ? v.split(/[,\s]+/).map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
          : [];
      }
      if (val === '' || val == null) continue;
      out[f.key] = val;
    }
    return this.cfg.createTransform ? this.cfg.createTransform(out) : out;
  }

  submit() {
    if (this.saving) return;
    this.saving = true;
    this.modalError = '';
    const body = this.payload();
    const key = this.editingKey;
    const isProfile = this.editMode === 'profile';
    const obs = isProfile
      ? this.api.patch(`${this.cfg.profile!.base}/${key}`, body)
      : this.editing
        ? this.api.patch(`${this.cfg.base}/${key}`, body)
        : this.api.post(this.cfg.createPath ?? this.cfg.base, body);
    obs.subscribe({
      next: () => {
        this.saving = false;
        this.modalOpen = false;
        this.showToast(this.editing ? 'Saved' : 'Created');
        this.load();
      },
      error: (e) => {
        this.saving = false;
        this.modalError = errText(e);
      },
    });
  }

  view(row: Row) {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.viewData = null;
    this.viewError = '';
    this.viewTitle = `${row[this.cfg.columns[0]?.key] ?? key}`;
    this.viewOpen = true;
    this.api.get<Row>(`${this.cfg.base}/${key}`).subscribe({
      next: (d) => {
        this.viewData = d;
      },
      error: (e) => {
        this.viewError = errText(e);
      },
    });
  }

  closeView() {
    this.viewOpen = false;
    this.viewData = null;
  }

  viewFields(): { key: string; label: string; value: string }[] {
    const d = this.viewData;
    if (!d) return [];
    const out: { key: string; label: string; value: string }[] = [];
    const labelFor = (k: string) => this.cfg.columns.find((c) => c.key === k)?.label ?? k;
    const push = (k: string, label: string, v: unknown) => {
      if (v === null || v === undefined || v === '') return;
      out.push({ key: k, label, value: String(v) });
    };
    const names = ['code', 'name', 'email', 'phone', 'grade', 'parent'];
    for (const k of names) push(k, labelFor(k), d[k]);
    const st = d['student'] as Row | null | undefined;
    if (st) {
      for (const k of ['code', 'name', 'email', 'phone', 'grade', 'parent'])
        push(`student.${k}`, k === 'code' ? 'Student code' : labelFor(k), st[k]);
      const school = st['school'] as { name?: string } | null | undefined;
      push('student.school', 'School', school?.name);
    }
    const school = d['school'] as { name?: string } | null | undefined;
    push('school.name', 'School', school?.name);
    const comp = d['competition'] as { title?: string; code?: string } | null | undefined;
    push('competition', 'Competition', comp ? `${comp.title ?? ''}${comp.code ? ` (${comp.code})` : ''}` : null);
    push('status', 'Status', d['status']);
    push('registeredAt', 'Registered', d['registeredAt']);
    push('createdAt', 'Created', d['createdAt']);
    return out;
  }

  studentRegs(st: { registrations?: Array<{ code?: string; competition?: { code?: string } }> }) {
    return (st.registrations ?? []).map((r) => r.code ?? '').join(', ') || '—';
  }

  studentStatus(st: { registrations?: Array<{ status?: string }> }) {
    return (st.registrations ?? []).map((r) => r.status ?? '').join(', ') || '—';
  }

  students(): Row[] {
    const v = this.viewData?.['students'];
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  payments(): Row[] {
    const v = this.viewData?.['payments'];
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  stageName(p: Row): string {
    const stage = p['stage'];
    if (stage && typeof stage === 'object') return String((stage as Row)['name'] ?? '');
    return String(p['stageId'] ?? '');
  }

  remove(row: Row) {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    const label = `${row[this.cfg.columns[0]?.key] ?? key}`;
    if (!window.confirm(`Delete "${label}"?`)) return;
    this.api.delete(`${this.cfg.base}/${key}`).subscribe({
      next: () => {
        this.showToast('Deleted');
        this.load();
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  private showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => {
      if (this.toast === msg) this.toast = '';
    }, 2200);
  }
}

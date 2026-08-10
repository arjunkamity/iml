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
            <h3>{{ editing ? 'Edit' : 'Add' }} {{ cfg.title.slice(0, -1) }}</h3>
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

  arrayText(v: unknown) {
    return Array.isArray(v) ? v.join(', ') : '';
  }

  badgeClass(c: { badgeMap?: Record<string, string> }, value: unknown) {
    const map = c.badgeMap ?? {};
    return map[String(value)] ?? 'grey';
  }

  filterOptions(f: { options?: string[]; ref?: 'competitions' }) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    return f.options ?? [];
  }

  fieldOptions(f: FieldDef) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    if (f.ref === 'schools') return this.refs.get('schools') ?? [];
    if (f.ref === 'registrations') return this.refs.get('registrations') ?? [];
    return f.options ?? [];
  }

  formFields(): FieldDef[] {
    if (!this.editing) return this.cfg.fields.filter((f) => f.type !== 'password' || !f.editOnly);
    return this.cfg.fields.filter((f) => !(f.type === 'password' && f.editOnly));
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

  private resetForm() {
    this.form = {};
    for (const f of this.cfg.fields) {
      if (f.type === 'checkbox') this.form[f.key] = false;
      else if (f.type === 'lines' || f.type === 'indices') this.form[f.key] = '';
      else this.form[f.key] = f.type === 'select' ? '' : '';
    }
  }

  openCreate() {
    this.resetForm();
    this.editing = false;
    this.editingKey = '';
    this.modalError = '';
    this.modalOpen = true;
  }

  openEdit(row: Row) {
    this.resetForm();
    this.editing = true;
    this.editingKey = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    for (const f of this.cfg.fields) {
      const v = row[f.key];
      if (f.type === 'date') this.form[f.key] = isoDate(v);
      else if (f.type === 'lines') this.form[f.key] = Array.isArray(v) ? v.join('\n') : '';
      else if (f.type === 'indices') this.form[f.key] = Array.isArray(v) ? v.join(',') : '';
      else if (f.type === 'number') this.form[f.key] = v;
      else if (f.type === 'checkbox') this.form[f.key] = !!v;
      else this.form[f.key] = v ?? '';
    }
    this.modalError = '';
    this.modalOpen = true;
  }

  closeModal() {
    if (this.saving) return;
    this.modalOpen = false;
  }

  private payload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of this.cfg.fields) {
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
    const obs = this.editing
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

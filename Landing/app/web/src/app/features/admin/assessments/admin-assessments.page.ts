import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { PanelApi } from '../../panel/panel-api.service';
import {
  AdminAssessmentRow,
  AdminCategory,
  AssessmentOverview,
  AssessmentsAdminApi,
  errText,
} from './assessments-admin.service';

interface Group {
  key: string;
  name: string;
  rows: AdminAssessmentRow[];
}

@Component({
  selector: 'app-admin-assessments',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (overview(); as o) {
      <div class="grid g4" style="margin-bottom:1.1rem">
        <div class="card stat">
          <b>{{ total() }}</b>
          <small>Assessments<br />{{ o.byStatus.Published || 0 }} live · {{ o.byStatus.Draft || 0 }} draft · {{ o.byStatus.Archived || 0 }} archived</small>
        </div>
        <div class="card stat"><b>{{ o.totalCompletions }}</b><small>Completed by students</small></div>
        <div class="card stat"><b>{{ o.last7Days }}</b><small>Completed in the last 7 days</small></div>
        <div class="card stat"><b>{{ o.last30Days }}</b><small>Completed in the last 30 days</small></div>
      </div>

      <div class="card" style="margin-bottom:1.1rem">
        <h3>Completions per day <small class="muted">last 30 days</small></h3>
        <svg class="spark" viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label="Completions per day for the last 30 days">
          @for (d of o.days; track d.date; let i = $index) {
            <rect [attr.x]="i * 10 + 1" [attr.width]="8" [attr.y]="56 - barHeight(d.count, o.days)" [attr.height]="barHeight(d.count, o.days)" rx="1.5">
              <title>{{ d.date }}: {{ d.count }}</title>
            </rect>
          }
        </svg>
      </div>
    }

    <div class="bar">
      <input class="search" placeholder="Search by title or code" [ngModel]="search()" (ngModelChange)="search.set($event); load()" />
      <select class="filter" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
        <option value="">All statuses</option>
        <option>Draft</option>
        <option>Published</option>
        <option>Archived</option>
      </select>
      <select class="filter" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event); load()">
        <option value="">All categories</option>
        @for (c of categories(); track c.id) {
          <option [value]="c.id">{{ c.name }}</option>
        }
        <option value="none">Uncategorised</option>
      </select>
      <div class="grow"></div>
      <button class="btn" (click)="openCategories()">Categories</button>
      <button class="btn" (click)="newPanelForm()">+ New panel form</button>
      <button class="btn btn-gold" (click)="openNew()">+ New assessment</button>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!groups().length) {
      <div class="card empty">No assessments match. Use "+ New assessment" to create one.</div>
    } @else {
      @for (g of groups(); track g.key) {
        <h2 class="grp">{{ g.name }} <small class="muted">{{ g.rows.length }}</small></h2>
        <div class="cards">
          @for (a of g.rows; track a.code) {
            <a class="card acard" [routerLink]="a.kind === 'panel' ? ['/admin/assessments/panel', a.code] : ['/admin/assessments', a.code]">
              <div class="top">
                <span class="bdg" [class.green]="a.status === 'Published'" [class.gold]="a.status === 'Draft'" [class.grey]="a.status === 'Archived'">{{ a.status }}</span>
                @if (a.kind === 'panel') { <span class="bdg purple">Panel</span> }
                <span class="code">{{ a.code }}</span>
              </div>
              <h3>{{ a.title }}</h3>
              @if (a.summary) {
                <p class="sum">{{ a.summary }}</p>
              }
              <div class="meta">
                <span><b>{{ a.questionCount }}</b> questions</span>
                @if (a.kind === 'panel') { <span>rated by a panel</span> } @else { <span><b>{{ a.completions }}</b> completed</span> }
                <span>Grades {{ a.grades || 'all' }}</span>
              </div>
              <small class="muted">Updated {{ a.updatedAt | date: 'd MMM y, h:mm a' }}</small>
            </a>
          }
        </div>
      }
    }

    @if (newOpen()) {
      <div class="modal-root" (click)="newOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>New assessment</h3><button class="m-x" (click)="newOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) {
              <div class="err">{{ modalError() }}</div>
            }
            <div class="f full">
              <label for="na-title">Title</label>
              <input id="na-title" type="text" [(ngModel)]="draft.title" maxlength="190" />
            </div>
            <div class="f-row">
              <div class="f">
                <label for="na-cat">Category</label>
                <select id="na-cat" [(ngModel)]="draft.categoryId">
                  <option [ngValue]="null">Uncategorised</option>
                  @for (c of categories(); track c.id) {
                    <option [ngValue]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="f">
                <label for="na-grades">Grades</label>
                <input id="na-grades" type="text" [(ngModel)]="draft.grades" placeholder="e.g. 9,10,11,12 or 9-12 (blank = all grades)" />
              </div>
            </div>
            <div class="f full">
              <label for="na-from">Start from</label>
              <select id="na-from" [(ngModel)]="draft.cloneFrom">
                <option value="">A blank assessment</option>
                @for (a of all(); track a.code) {
                  <option [value]="a.code">A copy of {{ a.title }} ({{ a.code }}) — capacities, bands and {{ a.questionCount }} questions</option>
                }
              </select>
              <div class="hint">A copy starts as a Draft you can edit freely. Use it to publish a corrected version of an assessment that already has results.</div>
            </div>
            <div class="f full">
              <label for="na-sum">Short description <small>(shown to students)</small></label>
              <textarea id="na-sum" [(ngModel)]="draft.summary"></textarea>
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="newOpen.set(false)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || draft.title.trim().length < 3" (click)="create()">{{ busy() ? 'Creating…' : 'Create draft' }}</button>
          </div>
        </div>
      </div>
    }

    @if (catsOpen()) {
      <div class="modal-root" (click)="catsOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Assessment categories</h3><button class="m-x" (click)="catsOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) {
              <div class="err">{{ modalError() }}</div>
            }
            <p class="hint" style="margin-top:0">Categories group assessments on this page. Deleting one never deletes its assessments — they move to "Uncategorised".</p>
            @for (c of catEdits(); track c.id) {
              <div class="cat-row">
                <input type="text" [(ngModel)]="c.name" maxlength="60" [attr.aria-label]="'Name of category ' + c.id" />
                <input class="pos" type="number" min="0" [(ngModel)]="c.position" title="Order (lower shows first)" aria-label="Order" />
                <button class="btn btn-sm" (click)="saveCategory(c)">Save</button>
                <button class="btn btn-sm btn-danger" (click)="removeCategory(c)">Delete</button>
                <small class="muted">{{ c.assessments }} assessment(s)</small>
              </div>
            } @empty {
              <div class="empty" style="padding:1rem">No categories yet.</div>
            }
            <div class="cat-row add">
              <input type="text" [(ngModel)]="newCategory" maxlength="60" placeholder="New category name" aria-label="New category name" />
              <button class="btn btn-gold btn-sm" [disabled]="!newCategory.trim()" (click)="addCategory()">Add</button>
            </div>
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
      .muted { color: var(--faint, #6e7f9e); font-weight: 500; }
      .grp { font-size: 0.78rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--faint, #6e7f9e); font-weight: 800; margin: 1.4rem 0 0.7rem; }
      .grp small { margin-left: 0.4rem; letter-spacing: 0; }
      .cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
      .acard { display: flex; flex-direction: column; gap: 0.45rem; transition: 0.15s; }
      .acard:hover { border-color: var(--gold, #e8b64a); transform: translateY(-1px); }
      .acard .top { display: flex; align-items: center; justify-content: space-between; }
      .acard .code { color: var(--faint, #6e7f9e); font-size: 0.78rem; font-weight: 700; }
      .acard h3 { margin: 0; font-size: 1.05rem; }
      .acard .sum { margin: 0; color: var(--muted, #9fb0d0); font-size: 0.86rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .acard .meta { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font-size: 0.82rem; color: var(--muted, #9fb0d0); }
      .acard .meta b { color: var(--text, #eef2fb); }
      .spark { width: 100%; height: 64px; display: block; }
      .spark rect { fill: var(--gold, #e8b64a); opacity: 0.85; }
      .spark rect:hover { opacity: 1; }
      .card h3 small { font-size: 0.78rem; margin-left: 0.4rem; }
      .cat-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
      .cat-row input[type='text'] { flex: 1 1 160px; min-width: 0; padding: 0.5rem 0.7rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .cat-row input.pos { width: 64px; padding: 0.5rem 0.5rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .cat-row.add { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--line, rgba(255,255,255,0.09)); }
    `,
  ],
})
export class AdminAssessmentsPage implements OnInit {
  private readonly api = inject(AssessmentsAdminApi);
  private readonly router = inject(Router);
  private readonly panelApi = inject(PanelApi);

  protected readonly overview = signal<AssessmentOverview | null>(null);
  protected readonly rows = signal<AdminAssessmentRow[]>([]);
  protected readonly all = signal<AdminAssessmentRow[]>([]);
  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly catEdits = signal<AdminCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly newOpen = signal(false);
  protected readonly catsOpen = signal(false);

  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly categoryFilter = signal('');

  protected newCategory = '';
  protected draft = { title: '', summary: '', grades: '9,10,11,12', categoryId: null as number | null, cloneFrom: '' };

  protected readonly total = computed(() => this.all().length);

  protected readonly groups = computed<Group[]>(() => {
    const byCat = new Map<number | null, AdminAssessmentRow[]>();
    for (const r of this.rows()) byCat.set(r.categoryId, [...(byCat.get(r.categoryId) ?? []), r]);
    const out: Group[] = [];
    for (const c of this.categories()) {
      const rows = byCat.get(c.id);
      if (rows?.length) out.push({ key: String(c.id), name: c.name, rows });
    }
    const none = byCat.get(null);
    if (none?.length) out.push({ key: 'none', name: 'Uncategorised', rows: none });
    return out;
  });

  ngOnInit(): void {
    this.load();
    this.api.overview().subscribe({ next: (o) => this.overview.set(o), error: (e) => this.error.set(errText(e)) });
  }

  protected load(): void {
    this.api.list({ status: this.status(), category: this.categoryFilter(), search: this.search() }).subscribe({
      next: (r) => {
        this.rows.set(r.assessments);
        this.categories.set(r.categories);
        this.loading.set(false);
        // The unfiltered set feeds the "start from a copy of" list and the total.
        if (!this.status() && !this.categoryFilter() && !this.search()) this.all.set(r.assessments);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
    if (this.status() || this.categoryFilter() || this.search()) {
      this.api.list({}).subscribe({ next: (r) => this.all.set(r.assessments) });
    }
  }

  protected barHeight(count: number, days: { count: number }[]): number {
    const max = Math.max(1, ...days.map((d) => d.count));
    return count ? Math.max(3, Math.round((count / max) * 52)) : 1;
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected newPanelForm(): void {
    const title = prompt('Name of the panel evaluation form (for example Live Showdown evaluation):', '');
    if (!title || title.trim().length < 3) return;
    this.panelApi.createForm({ title: title.trim() }).subscribe({
      next: (f) => this.router.navigate(['/admin/assessments/panel', f.code]),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected openNew(): void {
    this.draft = { title: '', summary: '', grades: '9,10,11,12', categoryId: null, cloneFrom: '' };
    this.modalError.set('');
    this.newOpen.set(true);
  }

  protected create(): void {
    this.busy.set(true);
    this.modalError.set('');
    const d = this.draft;
    this.api
      .create({
        title: d.title.trim(),
        summary: d.summary.trim() || undefined,
        grades: d.grades.trim() || undefined,
        categoryId: d.categoryId,
        cloneFrom: d.cloneFrom || undefined,
      })
      .subscribe({
        next: (a) => {
          this.busy.set(false);
          this.newOpen.set(false);
          this.router.navigate(['/admin/assessments', a.code]);
        },
        error: (e) => {
          this.busy.set(false);
          this.modalError.set(errText(e));
        },
      });
  }

  protected openCategories(): void {
    this.modalError.set('');
    this.api.categories().subscribe({
      next: (c) => {
        this.catEdits.set(c.map((x) => ({ ...x })));
        this.catsOpen.set(true);
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  private refreshCategories(): void {
    this.api.categories().subscribe((c) => this.catEdits.set(c.map((x) => ({ ...x }))));
    this.load();
  }

  protected addCategory(): void {
    this.modalError.set('');
    this.api.createCategory(this.newCategory.trim()).subscribe({
      next: () => {
        this.newCategory = '';
        this.flash('Category added');
        this.refreshCategories();
      },
      error: (e) => this.modalError.set(errText(e)),
    });
  }

  protected saveCategory(c: AdminCategory): void {
    this.modalError.set('');
    this.api.updateCategory(c.id, { name: c.name.trim(), position: Number(c.position) || 0 }).subscribe({
      next: () => {
        this.flash('Category saved');
        this.refreshCategories();
      },
      error: (e) => this.modalError.set(errText(e)),
    });
  }

  protected removeCategory(c: AdminCategory): void {
    const note = c.assessments ? ` Its ${c.assessments} assessment(s) will move to Uncategorised.` : '';
    if (!confirm(`Delete the category "${c.name}"?${note}`)) return;
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.flash('Category deleted');
        this.refreshCategories();
      },
      error: (e) => this.modalError.set(errText(e)),
    });
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SchoolDataService, SchoolResultRow } from './school-data.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

function errText(e: HttpErrorResponse): string {
  const m = (e.error as { message?: string | string[] })?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong.';
}

@Component({
  selector: 'app-school-results',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="bar">
      <select class="filter" [(ngModel)]="comp" (ngModelChange)="go(1)">
        <option value="">All competitions</option>
        @for (c of competitions(); track c.code) {
          <option [value]="c.code">{{ c.title }}</option>
        }
      </select>
      <div class="grow"></div>
      <span style="font-size:0.82rem;color:var(--muted,#9fb0d0)">{{ total() }} attempt{{ total() === 1 ? '' : 's' }}</span>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr><th>Student</th><th>Grade</th><th>Competition</th><th>Stage</th><th>Score</th><th>Finished</th><th></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr>
              <td>
                <span class="b">{{ r.student }}</span><br />
                <small style="color:var(--faint,#6e7f9e)">{{ r.studentCode }}</small>
              </td>
              <td>{{ r.grade }}</td>
              <td>
                <small>{{ r.competitionCode }}</small><br />
                {{ r.competition }}
              </td>
              <td>{{ r.stage ?? '—' }}</td>
              <td><span class="b">{{ r.score }}</span>/{{ r.total }}</td>
              <td>{{ r.finishedAt ? when(r.finishedAt) : 'In progress' }}</td>
              <td><a class="btn btn-sm" [routerLink]="['/schools/results', r.code]">View →</a></td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty">No attempts yet.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > 0) {
      <div class="pager">
        <span>{{ (page() - 1) * limit + 1 }}–{{ min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class SchoolResultsPage implements OnInit {
  private readonly data = inject(SchoolDataService);

  protected readonly rows = signal<SchoolResultRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 15;
  protected readonly error = signal('');
  protected readonly competitions = signal<{ code: string; title: string }[]>([]);
  protected comp = '';

  ngOnInit(): void {
    this.load();
    this.data.competitions().subscribe({
      next: (rows) => this.competitions.set(rows),
      error: () => this.competitions.set([]),
    });
  }

  private load(): void {
    this.error.set('');
    this.data.results(this.page(), this.limit, this.comp || undefined).subscribe({
      next: (r) => {
        this.rows.set(r.data);
        this.total.set(r.total);
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected go(p: number): void {
    this.page.set(p);
    this.load();
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  protected when(iso: string): string {
    return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—';
  }
}

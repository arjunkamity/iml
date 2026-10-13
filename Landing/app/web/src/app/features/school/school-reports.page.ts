import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

interface SchoolReport {
  id: number;
  student: { code: string; name: string; grade: string };
  competition: { code: string; title: string };
  stage: { position: number; name: string };
  version: number;
  releasedAt: string | null;
  pages: number | null;
}

function errText(e: HttpErrorResponse): string {
  const m = (e.error as { message?: string | string[] })?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong.';
}

@Component({
  selector: 'app-school-reports',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <p class="intro">
      Future Readiness reports of your students, once India Mind League has released them and the student has agreed to share with the school.
      Each report is the school's copy and may leave out sections meant only for the student.
    </p>

    <div class="bar">
      <input class="search" placeholder="Search by student name or code" [(ngModel)]="search" />
      <div class="grow"></div>
      <span class="count">{{ shown().length }} report{{ shown().length === 1 ? '' : 's' }}</span>
    </div>

    @if (awaiting() > 0) {
      <div class="note">{{ awaiting() }} released report{{ awaiting() === 1 ? ' is' : 's are' }} not shown yet because the student has not agreed to share with the school.</div>
    }
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Student</th><th>Grade</th><th>Stage</th><th>Released</th><th></th></tr></thead>
        <tbody>
          @for (r of shown(); track r.id) {
            <tr>
              <td data-label="Student"><span class="b">{{ r.student.name }}</span><br /><small class="faint">{{ r.student.code }}</small></td>
              <td data-label="Grade">{{ r.student.grade }}</td>
              <td data-label="Stage">Stage {{ r.stage.position }}: {{ r.stage.name }}<br /><small class="faint">{{ r.competition.title }}</small></td>
              <td data-label="Released">{{ r.releasedAt | date: 'd MMM y' }}</td>
              <td><div class="acts"><button class="btn btn-sm" [disabled]="busyId() === r.id" (click)="download(r)">{{ busyId() === r.id ? 'Preparing…' : 'Download PDF' }}</button></div></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty">{{ loading() ? 'Loading…' : 'No reports are available yet.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.1rem; }
      .count { font-size: 0.82rem; color: var(--muted, #9fb0d0); }
      .faint { color: var(--faint, #6e7f9e); }
      .note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin: 0 0 1rem; }
    `,
  ],
})
export class SchoolReportsPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly rows = signal<SchoolReport[]>([]);
  protected readonly awaiting = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busyId = signal(0);
  protected search = '';

  ngOnInit(): void {
    this.api.get<{ reports: SchoolReport[]; awaitingConsent: number }>('/school/reports').subscribe({
      next: (r) => {
        this.rows.set(r.reports);
        this.awaiting.set(r.awaitingConsent);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected shown(): SchoolReport[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.rows().filter((r) => `${r.student.name} ${r.student.code}`.toLowerCase().includes(q)) : this.rows();
  }

  protected download(r: SchoolReport): void {
    this.busyId.set(r.id);
    this.api.downloadBlob(`/school/reports/${r.id}/download`).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${r.student.code}-Future-Readiness-Stage-${r.stage.position}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.busyId.set(0);
      },
      error: (e: HttpErrorResponse) => {
        this.busyId.set(0);
        this.error.set(errText(e));
      },
    });
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface Summary {
  registrations: number;
  competitions: number;
  questions: number;
  upcomingExams: number;
  students: number;
  paidPayments: number;
}

interface Recent {
  recentRegistrations: Array<{
    code: string;
    status: string;
    student: { name: string; grade: string; email: string | null };
    competition: { title: string };
  }>;
  upcomingExams: Array<{
    code: string;
    title: string;
    grade: string;
    date: string;
    time: string;
    status: string;
    competition: { title: string };
  }>;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid g4">
      <div class="card stat"><small>Registrations</small><b>{{ s()?.registrations ?? '—' }}</b></div>
      <div class="card stat"><small>Students</small><b>{{ s()?.students ?? '—' }}</b></div>
      <div class="card stat"><small>Competitions</small><b>{{ s()?.competitions ?? '—' }}</b></div>
      <div class="card stat"><small>Paid payments</small><b>{{ s()?.paidPayments ?? '—' }}</b></div>
      <div class="card stat"><small>Questions</small><b>{{ s()?.questions ?? '—' }}</b></div>
      <div class="card stat"><small>Upcoming exams</small><b>{{ s()?.upcomingExams ?? '—' }}</b></div>
      <div class="card stat" style="grid-column: span 2">
        <small>Quick actions</small>
        <div style="display:flex;gap:0.5rem;margin-top:0.6rem;flex-wrap:wrap">
          <a class="btn btn-gold" href="/admin/registrations">+ Registration</a>
          <a class="btn" href="/admin/questions">Question bank</a>
          <a class="btn" href="/admin/exams">Exam dates</a>
          <a class="btn" href="/admin/notifications">Send notification</a>
        </div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:1rem">
      <div class="card">
        <h3>Recent registrations</h3>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Student</th><th>Competition</th><th>Status</th><th>Code</th></tr></thead>
            <tbody>
              @for (r of recent()?.recentRegistrations ?? []; track r.code) {
                <tr>
                  <td><span class="b">{{ r.student.name }}</span><small>{{ r.student.email }}</small></td>
                  <td>{{ r.competition.title }}</td>
                  <td><span class="bdg" [ngClass]="statusBadge(r.status)">{{ r.status }}</span></td>
                  <td>{{ r.code }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="empty">No registrations yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Upcoming exams</h3>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Exam</th><th>Grade</th><th>When</th><th>Status</th></tr></thead>
            <tbody>
              @for (e of recent()?.upcomingExams ?? []; track e.code) {
                <tr>
                  <td><span class="b">{{ e.title }}</span><small>{{ e.competition.title }}</small></td>
                  <td>{{ e.grade }}</td>
                  <td>{{ fmtWhen(e) }}</td>
                  <td><span class="bdg" [ngClass]="examBadge(e.status)">{{ e.status }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="empty">No upcoming exams.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminDashboardPage {
  private readonly api = inject(ApiService);
  readonly s = signal<Summary | null>(null);
  readonly recent = signal<Recent | null>(null);

  constructor() {
    this.api.get<Summary>('/dashboard/summary').subscribe({
      next: (v) => this.s.set(v),
      error: () => undefined,
    });
    this.api.get<Recent>('/dashboard/recent').subscribe({
      next: (v) => this.recent.set(v),
      error: () => undefined,
    });
  }

  statusBadge(status: string) {
    return { Registered: 'blue', 'Test Taken': 'purple', Qualified: 'green', Eliminated: 'red' }[status] ?? 'grey';
  }

  examBadge(status: string) {
    return { Scheduled: 'blue', Live: 'green', Closed: 'red', Draft: 'grey' }[status] ?? 'grey';
  }

  fmtWhen(e: { date: string; time: string }) {
    const d = typeof e.date === 'string' ? e.date.slice(0, 10) : '';
    const t = typeof e.time === 'string' ? e.time.slice(0, 5) : '';
    return `${d}${t ? ' · ' + t : ''}`;
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';import { StudentDataService } from '../student-data.service';
import { RouterLink } from '@angular/router';
import type { ExamView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDate, formatTime, startsInMs } from '../format';

@Component({
  selector: 'app-account-schedules',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Schedules</div>
        <h1 class="acc-title">Exam Schedule</h1>
        <p class="acc-sub">All tests lined up for the competitions you are registered in. Keep your credentials ready before each window.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading schedule…</div>
    } @else if (exams().length) {
      <div class="stat-grid" style="margin-bottom:1.1rem">
        <div class="stat">
          <span class="stat-ic iq">&#128197;</span>
          <div><b>{{ upcomingCount() }}</b><small>Upcoming</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic green">&#128308;</span>
          <div><b>{{ liveCount() }}</b><small>Live now</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic amber">&#9201;</span>
          <div><b>{{ nextTitle() }}</b><small>Next exam</small></div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Exam</th>
              <th>Grade</th>
              <th>Duration</th>
              <th>Competition</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (exam of exams(); track exam.code) {
              <tr>
                <td><b>{{ formatDate(exam.date) }}</b></td>
                <td>{{ formatTime(exam.time) }}</td>
                <td>
                  <b>{{ exam.title }}</b>
                  @if (exam.status === 'Live') {
                    <a class="btn btn-sm btn-primary" [routerLink]="['/exam', exam.code]" style="margin-left:0.5rem">Start Test →</a>
                  }
                </td>
                <td>{{ exam.grade ?? '—' }}</td>
                <td>{{ exam.durationMin ? exam.durationMin + ' min' : '—' }}</td>
                <td>
                  <small>{{ exam.competitionCode }}</small><br />
                  {{ exam.competitionTitle }}
                </td>
                <td>
                  <span class="tag" [class.tag-green]="exam.status === 'Live'" [class.tag-blue]="exam.status === 'Scheduled'">
                    <span class="status-dot"></span>{{ exam.status }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty">
        <div class="big">&#128197;</div>
        <h3>No exams scheduled</h3>
        <p>Exams will appear here once your competition publishes a schedule.</p>
      </div>
    }
  `,
  styles: [ACCOUNT_UI_CSS],
})
export class AccountSchedulesPage implements OnInit {
  private readonly data = inject(StudentDataService);
  protected readonly loading = signal(true);
  protected readonly exams = signal<ExamView[]>([]);

  protected readonly upcomingCount = computed(
    () => this.exams().filter((e) => e.status === 'Scheduled').length,
  );
  protected readonly liveCount = computed(
    () => this.exams().filter((e) => e.status === 'Live').length,
  );
  protected readonly nextTitle = computed(() => {
    const upcoming = this.exams().filter((e) => e.status !== 'Closed');
    upcoming.sort((a, b) => (startsInMs(a.date, a.time) ?? Infinity) - (startsInMs(b.date, b.time) ?? Infinity));
    return upcoming[0]?.title ?? '—';
  });

  ngOnInit(): void {
    this.data.schedules().subscribe({
      next: (exams) => {
        this.exams.set(exams);
        this.loading.set(false);
      },
      error: () => {
        this.exams.set([]);
        this.loading.set(false);
      },
    });
  }

  protected formatDate = formatDate;
  protected formatTime = formatTime;
}

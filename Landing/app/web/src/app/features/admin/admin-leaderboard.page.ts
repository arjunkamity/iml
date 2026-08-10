import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface LbRow {
  rank: number;
  attemptCode: string;
  student: string;
  studentCode: string;
  grade: string;
  school: string | null;
  score: number;
  total: number;
  stage: string | null;
  finishedAt: string;
}

@Component({
  selector: 'app-admin-leaderboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bar">
      <select class="filter" [(ngModel)]="comp" (ngModelChange)="load()">
        <option value="">All competitions</option>
        @for (c of comps(); track c) {
          <option [value]="c">{{ c }}</option>
        }
      </select>
      <div class="grow"></div>
      <span style="font-size:0.82rem;color:var(--muted)">{{ rows().length }} ranked</span>
    </div>

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr><th>Rank</th><th>Student</th><th>Grade</th><th>School</th><th>Stage</th><th>Score</th><th>Finished</th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.attemptCode) {
            <tr [class.top1]="r.rank === 1">
              <td>
                @if (r.rank === 1) {
                  <span class="bdg gold">1</span>
                } @else if (r.rank === 2) {
                  <span class="bdg blue">2</span>
                } @else if (r.rank === 3) {
                  <span class="bdg purple">3</span>
                } @else {
                  <span class="bdg grey">{{ r.rank }}</span>
                }
              </td>
              <td><span class="b">{{ r.student }}</span><small>{{ r.studentCode }}</small></td>
              <td>{{ r.grade }}</td>
              <td>{{ r.school ?? '—' }}</td>
              <td>{{ r.stage ?? '—' }}</td>
              <td><span class="b">{{ r.score }}</span>/{{ r.total }}</td>
              <td>{{ when(r.finishedAt) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty">No attempts ranked yet.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminLeaderboardPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<LbRow[]>([]);
  readonly comps = signal<string[]>([]);
  comp = '';

  constructor() {
    this.api.get<Array<{ code: string }>>('/competitions', { limit: 100 }).subscribe({
      next: (r) => this.comps.set((r as unknown as { data: Array<{ code: string }> }).data.map((c) => c.code)),
      error: () => undefined,
    });
    this.load();
  }

  load() {
    this.api.get<LbRow[]>('/leaderboard', this.comp ? { comp: this.comp } : {}).subscribe({
      next: (r) => this.rows.set(Array.isArray(r) ? r : []),
      error: () => this.rows.set([]),
    });
  }

  when(v: string) {
    return typeof v === 'string' ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—';
  }
}

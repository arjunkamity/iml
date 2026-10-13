import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-admin-reports',
  imports: [FormsModule],
  template: `
    <div class="section-title"><h1>Reports</h1></div>

    <div class="card">
      <h3>School-wise participation</h3>
      @if (schools().length) {
        <table class="table">
          <thead><tr><th>Code</th><th>School</th><th>Registered</th><th>Attempted</th><th>Avg</th><th>Top</th></tr></thead>
          <tbody>
            @for (s of schools(); track s.SchoolId + '-' + s.QuizId) {
              <tr>
                <td>{{ s.SchoolCode }}</td>
                <td>{{ s.SchoolName }}</td>
                <td>{{ s.RegisteredStudents }}</td>
                <td>{{ s.Attempted }}</td>
                <td>{{ s.AvgScore ?? '—' }}</td>
                <td>{{ s.TopScore ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading">No data yet.</div> }
    </div>

    <div class="card" style="margin-top:1rem;">
      <h3>Shortlist by quiz</h3>
      <div class="row" style="flex-wrap:nowrap; max-width:420px;">
        <input type="number" [(ngModel)]="quizId" placeholder="Quiz ID" />
        <input type="number" [(ngModel)]="top" placeholder="Top N" style="max-width:120px;" />
        <button class="btn btn-primary" (click)="loadShortlist()">Load</button>
      </div>
      @if (shortlist().length) {
        <table class="table" style="margin-top:1rem;">
          <thead><tr><th>Rank</th><th>Participant</th><th>School</th><th>Score</th><th>Accuracy</th><th>Time (s)</th></tr></thead>
          <tbody>
            @for (r of shortlist(); track r.UserId) {
              <tr>
                <td><b>#{{ r.Rnk }}</b></td>
                <td>{{ r.FullName }}</td>
                <td class="muted">{{ r.SchoolName }}</td>
                <td>{{ r.Score }}</td>
                <td>{{ r.AccuracyPct }}%</td>
                <td>{{ r.DurationTakenSeconds }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class AdminReportsComponent implements OnInit {
  private api = inject(ApiService);
  schools = signal<any[]>([]);
  shortlist = signal<any[]>([]);
  quizId = 2;
  top = 50;

  ngOnInit() {
    this.api.get<any[]>('/reports/schools').subscribe((r) => this.schools.set(r));
  }

  loadShortlist() {
    this.api
      .get<any[]>(`/reports/quizzes/${this.quizId}/shortlist?top=${this.top}`)
      .subscribe((r) => this.shortlist.set(r));
  }
}

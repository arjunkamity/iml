import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-coordinator-results',
  imports: [FormsModule],
  template: `
    <div class="section-title"><h1>Results</h1></div>
    <div class="card">
      <div class="row" style="flex-wrap:nowrap; max-width:360px;">
        <input type="number" [(ngModel)]="quizId" placeholder="Quiz ID" />
        <button class="btn btn-primary" (click)="load()">Load results</button>
      </div>
      @if (rows().length) {
        <table class="table" style="margin-top:1rem;">
          <thead><tr><th>Student</th><th>Score</th><th>Accuracy</th><th>Correct</th><th>Time (s)</th><th>Status</th></tr></thead>
          <tbody>
            @for (r of rows(); track r.UserId) {
              <tr>
                <td>{{ r.FullName }}</td>
                <td>{{ r.Score }}</td>
                <td>{{ r.AccuracyPct }}%</td>
                <td>{{ r.CorrectCount }}</td>
                <td>{{ r.DurationTakenSeconds }}</td>
                <td><span class="badge green">{{ r.Status }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading" style="margin-top:1rem;">Enter a quiz ID and load results for your school.</div> }
    </div>
  `,
})
export class CoordinatorResultsComponent {
  private api = inject(ApiService);
  rows = signal<any[]>([]);
  quizId = 2;

  load() {
    this.api
      .get<any[]>(`/reports/quizzes/${this.quizId}/results`)
      .subscribe((r) => this.rows.set(r));
  }
}

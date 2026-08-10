import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { QuizSummary } from '../../core/models';

@Component({
  selector: 'app-student-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <h1>Welcome 👋</h1>
    <p>Take your practice quizzes and the live qualifier here.</p>
    @if (msg()) { <div class="alert ok">{{ msg() }}</div> }

    <h3 style="margin-top:1.5rem;">Available Quizzes</h3>
    <div class="grid cols-3">
      @for (q of quizzes(); track q.QuizId) {
        <div class="card">
          <div class="spread">
            <span class="badge violet">{{ q.QuizType }}</span>
            <span class="muted">{{ (q.DurationSeconds / 60) | number:'1.0-0' }} min</span>
          </div>
          <h3 style="margin-top:.6rem;">{{ q.Title }}</h3>
          <p>{{ q.TotalQuestions }} questions</p>
          @if (q.AttemptStatus === 'Submitted' || q.AttemptStatus === 'AutoSubmitted') {
            <div class="badge green" style="margin-bottom:.6rem;">Completed · Score {{ q.Score }}</div>
            <button class="btn btn-block" (click)="getCertificate(q.QuizId)">Get Certificate</button>
          } @else if (q.AttemptStatus === 'InProgress') {
            <a class="btn btn-cyan btn-block" [routerLink]="['../quiz', q.QuizId]">Resume</a>
          } @else {
            <a class="btn btn-primary btn-block" [routerLink]="['../quiz', q.QuizId]">Start Quiz</a>
          }
        </div>
      } @empty {
        <div class="loading">No quizzes available yet.</div>
      }
    </div>

    <h3 style="margin-top:2rem;">My Certificates</h3>
    <div class="card">
      @if (certs().length) {
        <table class="table">
          <thead><tr><th>Certificate No</th><th>Quiz</th><th>Issued</th><th></th></tr></thead>
          <tbody>
            @for (c of certs(); track c.CertificateId) {
              <tr>
                <td><b>{{ c.CertificateNo }}</b></td>
                <td>{{ c.QuizTitle }}</td>
                <td class="muted">{{ c.IssuedAt | date:'mediumDate' }}</td>
                <td><button class="btn btn-sm" (click)="download(c.CertificateId, c.CertificateNo)">Download PDF</button></td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading">No certificates yet. Complete a quiz to earn one.</div> }
    </div>
  `,
})
export class StudentDashboardComponent implements OnInit {
  private api = inject(ApiService);
  quizzes = signal<QuizSummary[]>([]);
  certs = signal<any[]>([]);
  msg = signal<string | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.api.get<QuizSummary[]>('/quizzes/available').subscribe((r) => this.quizzes.set(r));
    this.api.get<any[]>('/certificates/me').subscribe((r) => this.certs.set(r));
  }

  getCertificate(quizId: number) {
    this.api.post('/certificates/issue/' + quizId).subscribe({
      next: () => { this.msg.set('Certificate ready — see below.'); this.load(); },
      error: (e) => this.msg.set(e?.error?.message ?? 'Could not issue certificate'),
    });
  }

  download(certId: number, certNo: string) {
    this.api.getBlob(`/certificates/${certId}/download`).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

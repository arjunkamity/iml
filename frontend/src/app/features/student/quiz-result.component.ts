import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AttemptResult, AttemptState } from '../../core/models';

@Component({
  selector: 'app-quiz-result',
  imports: [RouterLink],
  template: `
    @if (result(); as r) {
      <div class="card center" style="max-width:640px; margin:1rem auto;">
        <div class="badge green">{{ r.Status }}</div>
        <h1 style="margin:1rem 0 .25rem;">Your Score</h1>
        <div class="score">{{ r.Score }}</div>
        <p class="muted">Accuracy {{ r.AccuracyPct }}%</p>

        <div class="grid cols-3" style="margin:1.25rem 0;">
          <div class="stat card"><span class="num" style="color:var(--green)">{{ r.CorrectCount }}</span><span class="label">Correct</span></div>
          <div class="stat card"><span class="num" style="color:var(--red)">{{ r.WrongCount }}</span><span class="label">Wrong</span></div>
          <div class="stat card"><span class="num">{{ r.UnansweredCount }}</span><span class="label">Skipped</span></div>
        </div>

        @if (msg()) { <div class="alert ok">{{ msg() }}</div> }
        <div class="row" style="justify-content:center;">
          <button class="btn btn-primary" (click)="getCertificate(r.QuizId)">Get Certificate</button>
          <a class="btn btn-ghost" routerLink="/student/dashboard">Back to dashboard</a>
        </div>
      </div>
    } @else {
      <div class="loading">Loading result…</div>
    }
  `,
  styles: [`.score { font-size:4rem; font-weight:800; background:linear-gradient(90deg,#fff,var(--cyan));
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }`],
})
export class QuizResultComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  result = signal<AttemptResult | null>(null);
  msg = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('attemptId');
    this.api.get<AttemptState>(`/attempts/${id}`).subscribe((s) => {
      if (s.result) this.result.set(s.result);
    });
  }

  getCertificate(quizId: number) {
    this.api.post<any[]>(`/certificates/issue/${quizId}`).subscribe({
      next: (certs) => {
        const cert = certs?.[0];
        if (cert) this.download(cert.CertificateId, cert.CertificateNo);
        this.msg.set('Certificate downloaded.');
      },
      error: (e) => this.msg.set(e?.error?.message ?? 'Could not issue certificate'),
    });
  }

  private download(certId: number, certNo: string) {
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

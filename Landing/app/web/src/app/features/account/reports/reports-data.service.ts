import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface MyReport {
  id: number;
  competition: { code: string; title: string };
  edition: string;
  stage: { position: number; name: string };
  version: number;
  releasedAt: string | null;
  pages: number | null;
  sizeBytes: number | null;
}

export interface ConsentCard {
  season: { code: string; name: string; edition: string };
  required: boolean;
  text: string | null;
  textMissing: boolean;
  accepted: { parent: boolean; school: boolean };
}

@Injectable({ providedIn: 'root' })
export class ReportsDataService {
  private readonly api = inject(ApiService);

  list(): Observable<MyReport[]> {
    return this.api.get('/student/reports');
  }
  consent(): Observable<ConsentCard[]> {
    return this.api.get('/student/reports/consent');
  }
  setConsent(audience: 'parent' | 'school', season: string, accept: boolean): Observable<ConsentCard[]> {
    return this.api.post('/student/reports/consent', { audience, season, accept });
  }
  /** Saves the PDF the signed-in student is allowed to see. */
  download(r: MyReport): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob(`/student/reports/${r.id}/download`).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `IML-Future-Readiness-Report-Stage-${r.stage.position}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface AssessmentSummary {
  slug: string;
  title: string;
  summary: string | null;
  questionCount: number;
  completed: boolean;
  lastSubmittedAt: string | null;
}

export interface AssessmentItem {
  id: number;
  prompt: string;
  // Opaque token + text only — points and capacities are never sent to the browser.
  options: { token: string; text: string }[];
}

export interface AssessmentPlayer {
  slug: string;
  title: string;
  summary: string | null;
  consent: string;
  disclaimer: string;
  capacities: { label: string; intro: string }[];
  saveResults: boolean;
  items: AssessmentItem[];
}

export interface AssessmentResult {
  saved: boolean;
  submittedAt: string | null;
  dimensions: { key: string; label: string; score: number; max: number; percent: number; band: string; summary: string }[];
  strongest: string[];
  practice: { label: string; text: string }[];
  howScored: string;
  disclaimer: string;
}

@Injectable({ providedIn: 'root' })
export class AssessmentsDataService {
  private readonly api = inject(ApiService);

  list(): Observable<AssessmentSummary[]> {
    return this.api.get<AssessmentSummary[]>('/student/assessments');
  }

  get(slug: string): Observable<AssessmentPlayer> {
    return this.api.get<AssessmentPlayer>(`/student/assessments/${slug}`);
  }

  latestResult(slug: string): Observable<AssessmentResult> {
    return this.api.get<AssessmentResult>(`/student/assessments/${slug}/result`);
  }

  submit(slug: string, answers: { questionId: number; option: string }[]): Observable<AssessmentResult> {
    return this.api.post<AssessmentResult>(`/student/assessments/${slug}/submit`, { answers });
  }
}

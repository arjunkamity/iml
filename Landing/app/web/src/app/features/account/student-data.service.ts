import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface SchoolBrief {
  id: number;
  code: string;
  name: string;
}

export interface StageBrief {
  id: number;
  competitionId: number;
  position: number;
  name: string;
  mode: string;
  passMark: string;
  isFree: boolean;
  price: string;
  description?: string | null;
}

export interface RegistrationStageView {
  status: string;
  score?: string | null;
  qualified?: boolean | null;
  unlockedAt?: string | null;
  paidAt?: string | null;
  stage: StageBrief;
}

export interface AttemptBrief {
  code: string;
  startedAt: string;
  finishedAt: string | null;
  score: string;
  total: string;
  stage: { name: string; position: number } | null;
}

export interface PaymentBrief {
  code: string;
  amount: string;
  mode: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  stageId?: number | null;
}

export interface RegistrationView {
  code: string;
  status: string;
  registeredAt: string;
  competition: {
    code: string;
    title: string;
    grades: string;
    status: string;
  };
  stages: RegistrationStageView[];
  attempts: AttemptBrief[];
  payments: PaymentBrief[];
}

export interface MeProfile {
  id: number;
  code: string;
  name: string;
  grade: string;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  parent?: string | null;
  parentPhone?: string | null;
  address?: string | null;
  school?: SchoolBrief | null;
  hasPassword: boolean;
  registrations: RegistrationView[];
}

export interface ExamView {
  code: string;
  title: string;
  grade?: string | null;
  date?: string | null;
  time?: string | null;
  durationMin?: number | null;
  timing?: unknown;
  status: string;
  competitionCode?: string | null;
  competitionTitle?: string | null;
}

export interface ExamQuestion {
  id: number;
  code: string;
  category: string;
  qtype: string;
  media?: string | null;
  mode: string;
  label?: string | null;
  prompt: string;
  options: unknown[];
  timeLimitSecs?: number | null;
}

export interface ExamStageBrief {
  name: string;
  position: number;
}

export interface ExamAttempt {
  attemptCode: string;
  startedAt: string;
  durationMin: number;
  timing?: unknown;
  exam: {
    code: string;
    title: string;
    grade?: string | null;
    competitionCode?: string | null;
    competitionTitle?: string | null;
    stage?: ExamStageBrief | null;
  };
  questionCount: number;
  categories: string[];
  questions: ExamQuestion[];
}

export interface ExamReviewItem {
  questionId: number;
  code: string;
  category: string;
  mode: string;
  prompt: string;
  options: unknown[];
  correct: number[];
  given: number[];
  isCorrect: boolean;
}

export interface ExamSubmitResult {
  attemptCode: string;
  code: string;
  competition?: string | null;
  competitionCode?: string | null;
  stage?: string | null;
  stagePosition?: number | null;
  passMark: number;
  score: number;
  total: number;
  percent: number;
  startedAt: string;
  finishedAt: string;
  categories: ResultCategory[];
  review: ExamReviewItem[];
}

export interface ResultCategory {
  name: string;
  correct: number;
  total: number;
}

export interface ResultView {
  code: string;
  competition: string;
  competitionCode: string;
  stage: string | null;
  stagePosition: number | null;
  score: number;
  total: number;
  percent: number;
  startedAt: string;
  finishedAt: string | null;
  categories: ResultCategory[];
}

export interface ResultQuestion {
  questionId: number | null;
  code: string | null;
  category: string;
  mode: string;
  prompt: string;
  options: unknown[];
  correct: number[];
  given: number[];
  isCorrect: boolean;
  takenSecs?: number | null;
  timeUp?: boolean;
  answeredAt?: string | null;
}

export interface ResultDetail {
  code: string;
  competition: string;
  competitionCode: string;
  stage: string | null;
  stagePosition: number | null;
  passMark: number;
  qualified: boolean | null;
  score: number;
  total: number;
  percent: number;
  startedAt: string;
  finishedAt: string | null;
  categories: ResultCategory[];
  questions: ResultQuestion[];
}

export interface PaymentView {
  code: string;
  amount: number;
  mode: string;
  status: string;
  providerTxn?: string | null;
  paidAt?: string | null;
  createdAt: string;
  competition: string;
  competitionCode: string;
  stage?: string | null;
}

export interface GrievanceView {
  id: number;
  code: string;
  gtype: string;
  name?: string | null;
  contact?: string | null;
  subject?: string | null;
  message: string;
  status: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class StudentDataService {
  private readonly api = inject(ApiService);

  me(): Observable<MeProfile> {
    return this.api.get<MeProfile>('/student/me');
  }

  updateProfile(body: Record<string, unknown>): Observable<MeProfile> {
    return this.api.patch<MeProfile>('/student/me', body);
  }

  schedules(): Observable<ExamView[]> {
    return this.api.get<ExamView[]>('/student/schedules');
  }

  startExam(code: string): Observable<ExamAttempt> {
    return this.api.post<ExamAttempt>(`/student/exams/${code}/start`);
  }

  submitExam(
    code: string,
    body: {
      attemptCode: string;
      answers: {
        questionId: number;
        answer: number[];
        takenSecs?: number;
      }[];
    },
  ): Observable<ExamSubmitResult> {
    return this.api.post<ExamSubmitResult>(`/student/exams/${code}/submit`, body);
  }

  results(): Observable<ResultView[]> {
    return this.api.get<ResultView[]>('/student/results');
  }

  resultDetail(code: string): Observable<ResultDetail> {
    return this.api.get<ResultDetail>(`/student/results/${code}`);
  }

  payments(): Observable<PaymentView[]> {
    return this.api.get<PaymentView[]>('/student/payments');
  }

  grievances(): Observable<GrievanceView[]> {
    return this.api.get<GrievanceView[]>('/student/grievances');
  }

  createGrievance(body: {
    gtype: string;
    subject?: string;
    message: string;
  }): Observable<GrievanceView> {
    return this.api.post<GrievanceView>('/student/grievances', body);
  }

  setPassword(body: {
    currentPassword?: string;
    newPassword: string;
  }): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/student/password', body);
  }
}

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
  photoUrl?: string | null;
  school?: SchoolBrief | null;
  hasPassword: boolean;
  demoPromptSeen: boolean;
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
  // Present only when this exam has been split into batches — the student's
  // own assigned slot, which overrides date/time for display purposes.
  batch?: { label: string; startAt: string; durationMin: number } | null;
  batchPending?: boolean;
  // Non-null means the student already finished this exam's stage — show
  // "View Result" linking straight there instead of "Start".
  attemptCode?: string | null;
  // True when a finished attempt exists AND attemptsUsed < maxAttempts —
  // show a "Re-attempt" option alongside "View Result".
  canReattempt?: boolean;
  attemptsUsed?: number;
  maxAttempts?: number;
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
  /** Present only for a Question Group's sub-questions (see ExamAttempt.groups). */
  groupId?: number | null;
  groupPosition?: number | null;
}

/** The header shown above a Question Group's sub-questions. */
export interface ExamGroup {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface ExamStageBrief {
  name: string;
  position: number;
}

/** One question's saved progress, as returned by startExam() (from a prior
 * saveProgress() call) or sent TO saveProgress()/submitExam(). Shared shape
 * so all three call sites agree on it. */
export interface ExamAnswerPayload {
  questionId: number;
  answer: number[] | unknown;
  takenSecs?: number | null;
  timeUp?: boolean;
  changeCount?: number;
}

export interface ExamAttempt {
  attemptCode: string;
  startedAt: string;
  durationMin: number;
  /** Real seconds left, computed server-side from startedAt — present on
   * both a fresh start and a resumed (refreshed) attempt, so the timer
   * never silently resets to the full duration on reload. */
  remainingSecs?: number;
  timing?: unknown;
  /** True when this attempt already existed (a real resume) rather than
   * being freshly created — see StudentService.startExam(). Combined with
   * `savedAnswers` below, this is what lets the exam page offer "Resume
   * where you left off?" instead of silently either restarting blank or
   * only trusting a same-browser-tab sessionStorage mirror that a genuine
   * disconnect (closed tab, crashed browser, dead battery) would have
   * wiped along with everything else on that page. */
  resumed?: boolean;
  /** Whatever's been saved server-side for this attempt via saveProgress()
   * — empty on a fresh attempt, or a resumed one nobody has autosaved
   * anything for yet. */
  savedAnswers?: ExamAnswerPayload[];
  /** Which question the student was on at their last autosave — resume
   * jumps back here instead of always question 1. */
  lastQuestionId?: number | null;
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
  /** Headers for any Question Groups among the questions; absent when none are grouped. */
  groups?: ExamGroup[];
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
  // null = this stage caps qualifiers and the real outcome is still
  // pending an admin's Next Stage Selection — show "submitted, check
  // back later," never a guessed verdict.
  qualified: boolean | null;
  score: number;
  total: number;
  percent: number;
  // How this competition is configured to present the result — render
  // whichever of percent/score-total/grade `scoreDisplay` already is,
  // rather than always showing raw score + percent together.
  scoringMode: 'PERCENT' | 'GRADE' | 'FRACTION';
  scoreDisplay: string;
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
  scoringMode: 'PERCENT' | 'GRADE' | 'FRACTION';
  scoreDisplay: string;
  startedAt: string;
  finishedAt: string | null;
  /** Set once the Stage-1 participation certificate has actually been
   * issued (see the certificate queue) — null until then, even if the
   * attempt is finished, since issuance runs async in the background. */
  certificateNumber: string | null;
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
  /** Present only for a Question Group's questions. */
  groupCode?: string;
  groupTitle?: string;
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
  scoringMode: 'PERCENT' | 'GRADE' | 'FRACTION';
  scoreDisplay: string;
  certificateMode: 'INSTANT' | 'MANUAL';
  startedAt: string;
  finishedAt: string | null;
  certificateNumber: string | null;
  categories: ResultCategory[];
  // Computed server-side so it stays correct even when `questions` is
  // empty (showQuestionHistory off) — don't derive this from
  // questions.length on the frontend.
  attemptedCount: number;
  // False means the admin has turned off per-question review platform-wide
  // (Site Settings > Results Page) — `questions` will be empty even though
  // the student really did attempt some; show an explanatory note instead
  // of an empty list.
  showQuestionHistory: boolean;
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

/** Paytm Web Checkout form params — POSTed as a hidden auto-submit form. */
export interface InitiatePaymentResponse {
  orderId: string;
  amount: number;
  action: string;
  params: Record<string, string>;
}

export interface JoinCompetitionResult {
  registrationCode: string;
  alreadyRegistered: boolean;
  competition: { code: string; title: string };
  duePayment: { stageId: number; stageName: string; price: number } | null;
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

export interface GrievanceMessageView {
  id: number;
  authorType: 'student' | 'admin' | 'system';
  authorName: string;
  body: string;
  createdAt: string;
}

export interface GrievanceDetailView extends GrievanceView {
  messages: GrievanceMessageView[];
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

  /** Called the moment the one-time "try the Demo Exam" dashboard modal is
   * dismissed or acted on, so it never shows again for this student. */
  markDemoPromptSeen(): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/student/me/demo-prompt-seen');
  }

  uploadPhoto(file: File): Observable<MeProfile> {
    return this.api.postFile<MeProfile>('/student/photo', file);
  }

  removePhoto(): Observable<MeProfile> {
    return this.api.delete<MeProfile>('/student/photo');
  }

  schedules(): Observable<ExamView[]> {
    return this.api.get<ExamView[]>('/student/schedules');
  }

  /** Registers the already-logged-in student for an additional
   * competition — no OTP/profile form needed, they're already
   * authenticated. Idempotent: safe to call again for a competition
   * they're already in. */
  joinCompetition(competitionCode: string): Observable<JoinCompetitionResult> {
    return this.api.post<JoinCompetitionResult>(`/student/competitions/${competitionCode}/join`);
  }

  startExam(code: string): Observable<ExamAttempt> {
    return this.api.post<ExamAttempt>(`/student/exams/${code}/start`);
  }

  /** Periodic autosave while the exam is in progress — see
   * StudentService.saveProgress(). Never scores anything; purely durable
   * storage so a real disconnect has a server-side answer to resume from,
   * not just whatever one browser tab's sessionStorage still remembers. */
  saveProgress(
    code: string,
    body: { attemptCode: string; answers?: ExamAnswerPayload[]; lastQuestionId?: number },
  ): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/student/exams/${code}/progress`, body);
  }

  submitExam(
    code: string,
    body: {
      attemptCode: string;
      answers: ExamAnswerPayload[];
      clientElapsedSecs?: number;
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

  /** Manual fallback for a student to pull their own certificate on demand
   * instead of waiting on the automatic queue (see
   * StudentService.generateCertificate on the API side for why that queue
   * can legitimately stay closed for a while). */
  generateCertificate(code: string): Observable<{ certificateNumber: string }> {
    return this.api.post<{ certificateNumber: string }>(`/student/results/${code}/certificate/generate`, {});
  }

  payments(): Observable<PaymentView[]> {
    return this.api.get<PaymentView[]>('/student/payments');
  }

  initiatePayment(stageId: number): Observable<InitiatePaymentResponse> {
    return this.api.post<InitiatePaymentResponse>('/student/payments/initiate', { stageId });
  }

  /**
   * Paytm's classic Web Checkout flow expects a real browser form POST (not an
   * XHR/fetch) so it can redirect through to its hosted payment page. Build a
   * hidden auto-submitting form with the params the backend returned and
   * submit it — this navigates the browser away.
   */
  redirectToCheckout(init: InitiatePaymentResponse): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = init.action;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(init.params)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
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

  grievanceDetail(code: string): Observable<GrievanceDetailView> {
    return this.api.get<GrievanceDetailView>(`/student/grievances/${code}`);
  }

  addGrievanceReply(code: string, message: string): Observable<GrievanceDetailView> {
    return this.api.post<GrievanceDetailView>(`/student/grievances/${code}/reply`, { message });
  }

  setPassword(body: {
    currentPassword?: string;
    newPassword: string;
  }): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/student/password', body);
  }
}

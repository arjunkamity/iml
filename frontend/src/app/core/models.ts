export type RoleCode = 'ADMIN' | 'COORDINATOR' | 'STUDENT';

export interface AuthUser {
  id: number | string;
  role: RoleCode;
  schoolId: number | null;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface OtpVerifyResponse {
  verified: boolean;
  isNewUser: boolean;
  accessToken?: string;
  user?: AuthUser;
}

export interface QuizSummary {
  QuizId: number;
  Title: string;
  QuizType: string;
  DurationSeconds: number;
  TotalQuestions: number;
  MaxAttempts: number;
  AttemptStatus: string | null;
  Score: number | null;
}

export interface AttemptQuestionOption {
  optionId: string;
  text: string;
  order: number;
}

export interface AttemptQuestion {
  questionId: string;
  order: number;
  category: string;
  text: string;
  selectedOptionId: string | null;
  options: AttemptQuestionOption[];
}

export interface AttemptState {
  status: string;
  attemptId?: number;
  quizId?: number;
  secondsRemaining?: number;
  questions?: AttemptQuestion[];
  result?: AttemptResult;
}

export interface AttemptResult {
  AttemptId: number | string;
  QuizId: number;
  Status: string;
  Score: number;
  CorrectCount: number;
  WrongCount: number;
  UnansweredCount: number;
  AccuracyPct: number;
  DurationTakenSeconds: number;
  SubmittedAt: string;
}

export type PaymentPurpose = 'STAGE1_REGISTRATION' | 'STAGE3_BOOTCAMP';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/** Paytm Web Checkout form params — POSTed as a hidden auto-submit form. */
export interface InitiatePaymentResponse {
  orderId: string;
  amount: number;
  action: string;
  params: Record<string, string>;
}

export interface PaymentRecord {
  PaymentId: number | string;
  OrderId: string;
  UserId: number | string;
  Purpose: PaymentPurpose;
  Amount: number;
  Currency: string;
  Status: PaymentStatus;
  PaytmTxnId: string | null;
  PaymentMode: string | null;
  TxnDate: string | null;
  ResponseMsg: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

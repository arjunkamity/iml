import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface SchoolMe {
  id: number;
  code: string;
  name: string;
  city: string | null;
  contact: string | null;
  coordinator: string | null;
  email: string | null;
  phone: string | null;
  hasPassword: boolean;
  studentCount: number;
}

export interface SchoolStudentRow {
  code: string;
  name: string;
  grade: string;
  phone: string | null;
  email: string | null;
  parent: string | null;
  competition: string;
  competitionCode: string;
  status: string;
  paid: string;
  registeredAt: string;
}

export interface ListResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AddStudentPayload {
  competitionCode: string;
  name: string;
  grade: string;
  email?: string;
  phone?: string;
  parent?: string;
}

export interface UpdateStudentPayload {
  name?: string;
  grade?: string;
  email?: string;
  phone?: string;
  parent?: string;
}

export interface SchoolResultRow {
  code: string;
  student: string;
  studentCode: string;
  grade: string;
  competition: string;
  competitionCode: string;
  stage: string | null;
  stagePosition: number | null;
  score: number;
  total: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface SchoolResultQuestion {
  questionId: number | null;
  code: string | null;
  category: string;
  mode: string;
  prompt: string;
  options: unknown[];
  correct: number[];
  given: number[];
  isCorrect: boolean;
  takenSecs: number | null;
  /** Present only for a Question Group's questions. */
  groupCode?: string;
  groupTitle?: string;
}

export interface SchoolResultDetail {
  code: string;
  student: string;
  studentCode: string;
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
  certificateNumber: string | null;
  questions: SchoolResultQuestion[];
}

export interface SchoolPaymentRow {
  code: string;
  student: string;
  studentCode: string;
  competition: string;
  competitionCode: string;
  stage: string | null;
  stagePosition: number | null;
  amount: string;
  mode: string;
  status: string;
  providerTxn: string | null;
  paidAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SchoolDataService {
  private readonly api = inject(ApiService);

  me(): Observable<SchoolMe> {
    return this.api.get<SchoolMe>('/school/me');
  }

  updateProfile(body: { name?: string; city?: string; contact?: string; coordinator?: string }): Observable<SchoolMe> {
    return this.api.patch<SchoolMe>('/school/me', body);
  }

  setPassword(body: { currentPassword?: string; newPassword: string }): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/school/password', body);
  }

  students(
    page: number,
    limit: number,
    search?: string,
    comp?: string,
    grade?: string,
    paymentStatus?: string,
  ): Observable<ListResult<SchoolStudentRow>> {
    // HttpClient's `params` shorthand stringifies every value, including
    // `undefined` itself (-> the literal string "undefined"), so an
    // omitted search must never be passed as a key at all — a real bug
    // caught while testing this: a blank search box silently filtered
    // every row out instead of showing all of them.
    const params: Record<string, unknown> = { page, limit };
    if (search) params['search'] = search;
    if (comp) params['comp'] = comp;
    if (grade) params['grade'] = grade;
    if (paymentStatus) params['paymentStatus'] = paymentStatus;
    return this.api.get<ListResult<SchoolStudentRow>>('/school/students', params);
  }

  competitions(): Observable<{ code: string; title: string }[]> {
    return this.api.get<{ code: string; title: string }[]>('/school/competitions');
  }

  addStudent(body: AddStudentPayload): Observable<{ code: string }> {
    return this.api.post<{ code: string }>('/school/students', body);
  }

  updateStudent(code: string, body: UpdateStudentPayload): Observable<{ ok: boolean }> {
    return this.api.patch<{ ok: boolean }>(`/school/students/${code}`, body);
  }

  results(page: number, limit: number, comp?: string): Observable<ListResult<SchoolResultRow>> {
    const params: Record<string, unknown> = { page, limit };
    if (comp) params['comp'] = comp;
    return this.api.get<ListResult<SchoolResultRow>>('/school/results', params);
  }

  resultDetail(code: string): Observable<SchoolResultDetail> {
    return this.api.get<SchoolResultDetail>(`/school/results/${code}`);
  }

  payments(page: number, limit: number, comp?: string, status?: string, grade?: string): Observable<ListResult<SchoolPaymentRow>> {
    const params: Record<string, unknown> = { page, limit };
    if (comp) params['comp'] = comp;
    if (status) params['status'] = status;
    if (grade) params['grade'] = grade;
    return this.api.get<ListResult<SchoolPaymentRow>>('/school/payments', params);
  }
}

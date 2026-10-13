import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type AssessmentStatus = 'Draft' | 'Published' | 'Archived';

export interface AdminCategory {
  id: number;
  name: string;
  position: number;
  active: boolean;
  assessments: number;
}

export interface AdminAssessmentRow {
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  grades: string | null;
  status: AssessmentStatus;
  categoryId: number | null;
  category: string | null;
  kind?: string;
  questionCount: number;
  completions: number;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export interface AssessmentOverview {
  byStatus: Partial<Record<AssessmentStatus, number>>;
  totalCompletions: number;
  last7Days: number;
  last30Days: number;
  days: { date: string; count: number }[];
  top: { code: string; title: string; completions: number }[];
}

export interface AssessmentBandDef {
  label: string;
  min: number;
  max: number;
  summary: string;
}

export interface AssessmentCapacityDef {
  key: string;
  label: string;
  intro: string;
  practice: string;
  bands: AssessmentBandDef[];
}

export interface AdminAssessment {
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  grades: string | null;
  status: AssessmentStatus;
  categoryId: number | null;
  category: string | null;
  consent: string;
  disclaimer: string;
  howScored: string;
  dimensions: AssessmentCapacityDef[];
  questionCount: number;
  completions: number;
  locked: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issues: string[];
  studentPath: string;
}

export interface AdminAssessmentQuestion {
  id: number;
  code: string;
  capacity: string;
  prompt: string;
  options: string[];
  points: number[];
}

export interface BulkResult {
  dryRun: boolean;
  total: number;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export type ScoreMap = Record<string, { score: number; max: number; band: string }>;

export interface SubmissionRow {
  id: number;
  studentCode: string;
  studentName: string;
  grade: string | null;
  schoolCode: string | null;
  school: string | null;
  submittedAt: string;
  scores: ScoreMap;
}

export interface SubmissionDetail extends Omit<SubmissionRow, 'schoolCode'> {
  answers: { code: string; capacity: string; prompt: string; chosen: string; points: number }[];
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AssessmentAnalytics {
  total: number;
  eligibleStudents: number;
  completionRate: number;
  perCapacity: {
    key: string;
    label: string;
    averageScore: number;
    averageMax: number;
    averagePercent: number;
    bands: { label: string; count: number }[];
  }[];
  byGrade: { grade: string; count: number; percent: Record<string, number> }[];
  bySchool: { code: string; school: string; count: number; percent: Record<string, number> }[];
  byDay: { date: string; count: number }[];
}

export interface PreviewResult {
  dimensions: { key: string; label: string; score: number; max: number; band: string; summary: string }[];
  strongest: string[];
  practiceFor: string[];
}

export interface ResultFilters {
  search?: string;
  grade?: string;
  school?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function errText(e: unknown): string {
  const m = (e as { error?: { message?: string | string[] }; message?: string })?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? (e as { message?: string })?.message ?? 'Something went wrong.';
}

function clean(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

@Injectable({ providedIn: 'root' })
export class AssessmentsAdminApi {
  private readonly api = inject(ApiService);

  overview(): Observable<AssessmentOverview> {
    return this.api.get('/assessments/overview');
  }
  list(f: { status?: string; category?: string; search?: string }): Observable<{ categories: AdminCategory[]; assessments: AdminAssessmentRow[] }> {
    return this.api.get('/assessments', clean(f));
  }
  get(code: string): Observable<AdminAssessment> {
    return this.api.get(`/assessments/${code}`);
  }
  create(body: { title: string; summary?: string; categoryId?: number | null; grades?: string; cloneFrom?: string }): Observable<AdminAssessment> {
    return this.api.post('/assessments', body);
  }
  update(code: string, body: Record<string, unknown>): Observable<AdminAssessment> {
    return this.api.patch(`/assessments/${code}`, body);
  }
  remove(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/assessments/${code}`);
  }
  publish(code: string): Observable<AdminAssessment> {
    return this.api.post(`/assessments/${code}/publish`);
  }
  archive(code: string): Observable<AdminAssessment> {
    return this.api.post(`/assessments/${code}/archive`);
  }
  unarchive(code: string): Observable<AdminAssessment> {
    return this.api.post(`/assessments/${code}/unarchive`);
  }

  categories(): Observable<AdminCategory[]> {
    return this.api.get('/assessment-categories');
  }
  createCategory(name: string): Observable<AdminCategory> {
    return this.api.post('/assessment-categories', { name });
  }
  updateCategory(id: number, body: Partial<Pick<AdminCategory, 'name' | 'position' | 'active'>>): Observable<AdminCategory> {
    return this.api.patch(`/assessment-categories/${id}`, body);
  }
  deleteCategory(id: number): Observable<{ ok: boolean }> {
    return this.api.delete(`/assessment-categories/${id}`);
  }

  questions(code: string): Observable<AdminAssessmentQuestion[]> {
    return this.api.get(`/assessments/${code}/questions`);
  }
  createQuestion(code: string, body: { capacity: string; prompt: string; options: string[]; points: number[] }): Observable<AdminAssessmentQuestion> {
    return this.api.post(`/assessments/${code}/questions`, body);
  }
  updateQuestion(code: string, qcode: string, body: { capacity: string; prompt: string; options: string[]; points: number[] }): Observable<AdminAssessmentQuestion> {
    return this.api.patch(`/assessments/${code}/questions/${qcode}`, body);
  }
  deleteQuestion(code: string, qcode: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/assessments/${code}/questions/${qcode}`);
  }
  bulkUpload(code: string, file: File, dryRun: boolean): Observable<BulkResult> {
    return this.api.postFile(`/assessments/${code}/questions/bulk-upload${dryRun ? '?dryRun=true' : ''}`, file);
  }
  preview(code: string, answers: { questionId: number; optionIndex: number }[]): Observable<PreviewResult> {
    return this.api.post(`/assessments/${code}/preview`, { answers });
  }

  submissions(code: string, f: ResultFilters, page: number, limit = 20): Observable<Page<SubmissionRow>> {
    return this.api.get(`/assessments/${code}/submissions`, clean({ ...f, page, limit }));
  }
  submission(code: string, id: number): Observable<SubmissionDetail> {
    return this.api.get(`/assessments/${code}/submissions/${id}`);
  }
  deleteSubmission(code: string, id: number): Observable<{ ok: boolean }> {
    return this.api.delete(`/assessments/${code}/submissions/${id}`);
  }
  analytics(code: string, f: ResultFilters): Observable<AssessmentAnalytics> {
    return this.api.get(`/assessments/${code}/analytics`, clean({ ...f }));
  }

  download(path: string, filename: string, params?: Record<string, unknown>): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob(path, params ? clean(params) : undefined).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }
  exportResults(code: string, f: ResultFilters): Observable<void> {
    return this.download(`/assessments/${code}/export`, `${code}-results.xlsx`, { ...f });
  }
  sampleCsv(): Observable<void> {
    return this.download('/assessments/questions-sample', 'assessment-questions-sample.csv');
  }
}

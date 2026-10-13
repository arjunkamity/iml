import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface QuestionGroupRow {
  code: string;
  title: string;
  category: string;
  active: boolean;
  competitionCode: string | null;
  competition: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  questionCount: number;
  ready: boolean;
}

export interface QuestionGroupDetail {
  code: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string;
  active: boolean;
  competitionCode: string | null;
  competition: string | null;
  questionCount: number;
  questions: { code: string; prompt: string; category: string; position: number }[];
  ready: boolean;
  /** True while the competition has a live exam: questions can't be changed. */
  membershipLocked: boolean;
}

export interface GroupCandidate {
  code: string;
  prompt: string;
  category: string;
  qtype: string;
}

export interface GroupBody {
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  competitionCode?: string;
  category?: string;
  active?: boolean;
  questionCodes?: string[];
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

function clean(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

export function errText(e: unknown): string {
  const m = (e as { error?: { message?: string | string[] }; message?: string })?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? (e as { message?: string })?.message ?? 'Something went wrong.';
}

/** Question prompts are stored as rich text; the admin lists show them as plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable({ providedIn: 'root' })
export class QuestionGroupsApi {
  private readonly api = inject(ApiService);

  list(f: { search?: string; comp?: string; category?: string; status?: string }, page: number, limit = 20): Observable<Page<QuestionGroupRow>> {
    return this.api.get('/question-groups', clean({ ...f, page, limit }));
  }
  get(code: string): Observable<QuestionGroupDetail> {
    return this.api.get(`/question-groups/${code}`);
  }
  create(body: GroupBody): Observable<QuestionGroupDetail> {
    return this.api.post('/question-groups', body);
  }
  update(code: string, body: Partial<GroupBody>): Observable<QuestionGroupDetail> {
    return this.api.patch(`/question-groups/${code}`, body);
  }
  remove(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/question-groups/${code}`);
  }
  candidates(f: { comp: string; category: string; search?: string; group?: string }): Observable<GroupCandidate[]> {
    return this.api.get('/question-groups/candidates', clean(f));
  }
  competitions(): Observable<{ data: { code: string; title: string; status: string }[] }> {
    return this.api.get('/competitions', { limit: 200 });
  }
  categories(): Observable<{ data: { name: string; active: boolean }[] }> {
    return this.api.get('/question-categories', { limit: 200 });
  }
}

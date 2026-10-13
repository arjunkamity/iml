import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export function errText(e: unknown): string {
  const m = (e as { error?: { message?: string | string[] }; message?: string })?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? (e as { message?: string })?.message ?? 'Something went wrong.';
}

// ------------------------------------------------------------------ forms
export interface PanelOption {
  label: string;
  points: number;
  hint: string;
}
export interface PanelCompetency {
  code: string;
  label: string;
  dimension: string;
  prompt: string;
  weight: number;
  options: PanelOption[];
}
export interface PanelSettings {
  requiredRaters: number;
  disagreementGap: number;
  requireComment: boolean;
  noteRequired: boolean;
  noteLabel: string;
  method: 'mean' | 'trimmed';
}
export interface PanelFormRow {
  code: string;
  title: string;
  status: string;
  competencies: number;
  requiredRaters: number;
  usedBy: number;
  locked: boolean;
  updatedAt: string;
}
export interface PanelForm {
  code: string;
  title: string;
  summary: string | null;
  status: string;
  settings: PanelSettings;
  competencies: PanelCompetency[];
  issues: string[];
  locked: boolean;
  usedBy: { competition: string; competitionTitle: string; stage: number; stageName: string; state: string }[];
}
export interface FormProgress {
  competition: string;
  competitionTitle: string;
  stage: number;
  stageName: string;
  state: string;
  requiredRaters: number;
  studentsWithRatings: number;
  studentsFullyRated: number;
  submittedRatings: number;
  draftRatings: number;
}

// -------------------------------------------------------------- panelists and stages
export interface Panelist {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  notes: string | null;
  lastLoginAt: string | null;
  inviteExpiresAt: string | null;
  hasPassword: boolean;
  enrolments: number;
}
export interface StageStatus {
  competition: { code: string; title: string };
  stage: { id: number; position: number; name: string; mode: string; passMark: number; maxQualifiers: number | null };
  state: string;
  form: { code: string; title: string; status: string } | null;
  requiredRaters: number;
  rosterSize: number;
  panelists: { enrolmentId: number; panelistId: number; code: string; name: string; email: string; status: string; conflictSchools: number[] }[];
  readyIssues: string[];
  openBlockers: string[];
  canMarkReady: boolean;
  canOpen: boolean;
  ratings: { submitted: number; drafts: number };
}
export interface ControlStudent {
  registrationId: number;
  code: string;
  name: string;
  grade: string;
  school: string | null;
  required: number;
  submitted: number;
  drafts: number;
  status: string;
  percent: number | null;
  average: number | null;
  levelKey: string | null;
  levelLabel: string | null;
  flagged: boolean;
  adjudicated: boolean;
}
export interface Control extends StageStatus {
  levels: { key: string; label: string }[];
  students: ControlStudent[];
  panelistProgress: { panelistId: number; name: string; email: string; status: string; assigned: number; submitted: number; drafts: number; notStarted: number }[];
  summary: { students: number; rated: number; missing: number; flagged: number };
}
export interface StudentDetail {
  student: { registrationId: number; code: string; name: string };
  form: { code: string; title: string; noteLabel: string; competencies: PanelCompetency[] };
  ratings: { id: number; panelist: string; status: string; ratings: Record<string, { optionIndex: number; points: number; comment?: string }>; note: string | null }[];
  result: { status: string; percent: number | null; levelKey: string | null; flagged: boolean; competencies: { code: string; label: string; values: number[]; mean: number | null; final: number | null; levelKey: string | null; spread: number; flagged: boolean; adjudicated: boolean }[] };
  adjudication: { overrides: Record<string, number>; reason: string; decidedByName: string | null } | null;
}

// ----------------------------------------------------------------------- portal
export interface DashboardStage {
  stageId: number;
  competition: string;
  competitionTitle: string;
  stage: number;
  stageName: string;
  state: string;
  label: string;
  canRate: boolean;
  progress: { rated: number; drafts: number; total: number };
}
export interface PortalStudent {
  registrationId: number;
  code: string;
  name: string;
  grade: string;
  school: string | null;
  status: 'Not started' | 'Draft' | 'Submitted';
}
export interface RatingPage {
  stage: { id: number; position: number; name: string };
  student: { registrationId: number; code: string; name: string; grade: string; school: string | null };
  form: { code: string; title: string; noteLabel: string; noteRequired: boolean; requireComment: boolean; competencies: PanelCompetency[] };
  rating: { status: string; ratings: Record<string, { optionIndex: number; points: number; comment?: string }>; note: string; submittedAt: string | null };
}
export interface Narrative {
  student: { registrationId: number; code: string; name: string };
  systemDraft: string;
  draftText: string;
  approvedText: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  gaps: string[];
}

@Injectable({ providedIn: 'root' })
export class PanelApi {
  private readonly api = inject(ApiService);

  // forms
  forms(): Observable<PanelFormRow[]> {
    return this.api.get('/panel-forms');
  }
  form(code: string): Observable<PanelForm> {
    return this.api.get(`/panel-forms/${code}`);
  }
  createForm(body: { title: string; summary?: string; settings?: Partial<PanelSettings>; cloneFrom?: string }): Observable<PanelForm> {
    return this.api.post('/panel-forms', body);
  }
  updateForm(code: string, body: { title?: string; summary?: string; settings?: Partial<PanelSettings> }): Observable<PanelForm> {
    return this.api.patch(`/panel-forms/${code}`, body);
  }
  formAction(code: string, action: 'publish' | 'archive' | 'unarchive'): Observable<PanelForm> {
    return this.api.post(`/panel-forms/${code}/${action}`);
  }
  deleteForm(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/panel-forms/${code}`);
  }
  formProgress(code: string): Observable<FormProgress[]> {
    return this.api.get(`/panel-forms/${code}/progress`);
  }
  addCompetency(code: string, body: Record<string, unknown>): Observable<PanelCompetency> {
    return this.api.post(`/panel-forms/${code}/competencies`, body);
  }
  updateCompetency(code: string, qcode: string, body: Record<string, unknown>): Observable<PanelCompetency> {
    return this.api.patch(`/panel-forms/${code}/competencies/${qcode}`, body);
  }
  deleteCompetency(code: string, qcode: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/panel-forms/${code}/competencies/${qcode}`);
  }

  // panelists
  panelists(search?: string): Observable<Panelist[]> {
    return this.api.get('/panel/panelists', search ? { search } : undefined);
  }
  createPanelist(body: { name: string; email: string; phone?: string; notes?: string }): Observable<Panelist> {
    return this.api.post('/panel/panelists', body);
  }
  updatePanelist(id: number, body: Partial<{ name: string; email: string; phone: string; notes: string }>): Observable<Panelist> {
    return this.api.patch(`/panel/panelists/${id}`, body);
  }
  panelistAction(id: number, action: 'resend' | 'disable' | 'enable'): Observable<Panelist> {
    return this.api.post(`/panel/panelists/${id}/${action}`);
  }
  deletePanelist(id: number): Observable<{ ok: boolean }> {
    return this.api.delete(`/panel/panelists/${id}`);
  }

  // stage control
  private base(comp: string, stage: number) {
    return `/panel/competitions/${encodeURIComponent(comp)}/stages/${stage}`;
  }
  status(comp: string, stage: number): Observable<StageStatus> {
    return this.api.get(this.base(comp, stage));
  }
  setup(comp: string, stage: number, body: { formCode?: string; requiredRaters?: number }): Observable<StageStatus> {
    return this.api.put(`${this.base(comp, stage)}/setup`, body);
  }
  enrol(comp: string, stage: number, panelistId: number, conflictSchools: number[]): Observable<StageStatus> {
    return this.api.post(`${this.base(comp, stage)}/panelists`, { panelistId, conflictSchools });
  }
  unenrol(comp: string, stage: number, panelistId: number): Observable<StageStatus> {
    return this.api.delete(`${this.base(comp, stage)}/panelists/${panelistId}`);
  }
  lifecycle(comp: string, stage: number, action: 'ready' | 'open' | 'close' | 'finalize' | 'override' | 'release', body: Record<string, unknown> = {}): Observable<StageStatus> {
    return this.api.post(`${this.base(comp, stage)}/${action}`, body);
  }
  control(comp: string, stage: number): Observable<Control> {
    return this.api.get(`${this.base(comp, stage)}/control`);
  }
  studentDetail(comp: string, stage: number, reg: number): Observable<StudentDetail> {
    return this.api.get(`${this.base(comp, stage)}/students/${reg}`);
  }
  adjudicate(comp: string, stage: number, reg: number, overrides: Record<string, number>, reason: string): Observable<StudentDetail> {
    return this.api.post(`${this.base(comp, stage)}/students/${reg}/adjudicate`, { overrides, reason });
  }
  reopenRating(id: number, reason: string): Observable<{ ok: boolean }> {
    return this.api.post(`/panel/ratings/${id}/reopen`, { reason });
  }
  remind(comp: string, stage: number, panelistId?: number): Observable<{ sent: number }> {
    return this.api.post(`${this.base(comp, stage)}/remind`, panelistId ? { panelistId } : {});
  }
  exportXlsx(comp: string, stage: number): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob(`${this.base(comp, stage)}/export`).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${comp}-stage-${stage}-panel.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }
  selectionPreview(comp: string, stageId: number): Observable<Record<string, unknown>> {
    return this.api.get(`/competitions/${comp}/stages/${stageId}/selection-preview`);
  }
  selectionCommit(comp: string, stageId: number): Observable<{ qualified: number; eliminated: number; notRated?: number }> {
    return this.api.post(`/competitions/${comp}/stages/${stageId}/selection-commit`);
  }

  // portal
  login(userId: string, password: string): Observable<{ challenge: string; expiresIn: number; sentTo: { email: boolean; phone: boolean } }> {
    return this.api.post('/panel/auth/login', { userId, password });
  }
  verify(challenge: string, code: string): Observable<{ accessToken: string; panelist: { id: number; code: string; name: string; email: string } }> {
    return this.api.post('/panel/auth/verify', { challenge, code });
  }
  setPassword(token: string, password: string): Observable<{ ok: boolean }> {
    return this.api.post('/panel/auth/set-password', { token, password });
  }
  forgot(userId: string): Observable<{ ok: boolean }> {
    return this.api.post('/panel/auth/forgot', { userId });
  }
  dashboard(): Observable<DashboardStage[]> {
    return this.api.get('/panel/me/stages');
  }
  students(stageId: number, q: { search?: string; school?: string; status?: string }): Observable<{ stage: { id: number; position: number; name: string }; total: number; schools: string[]; rows: PortalStudent[] }> {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(q)) if (v) params[k] = v;
    return this.api.get(`/panel/me/stages/${stageId}/students`, params);
  }
  rating(stageId: number, reg: number): Observable<RatingPage> {
    return this.api.get(`/panel/me/stages/${stageId}/students/${reg}`);
  }
  saveRating(stageId: number, reg: number, body: { ratings: Record<string, { optionIndex: number; comment?: string }>; note: string; submit: boolean }): Observable<RatingPage> {
    return this.api.put(`/panel/me/stages/${stageId}/students/${reg}`, body);
  }
  notes(stageId: number): Observable<{ stage: { id: number; position: number; name: string }; rows: { registrationId: number; code: string; name: string; school: string | null; status: string }[] }> {
    return this.api.get(`/panel/me/stages/${stageId}/notes`);
  }
  narrative(stageId: number, reg: number): Observable<Narrative> {
    return this.api.get(`/panel/me/stages/${stageId}/students/${reg}/narrative`);
  }
  saveNarrative(stageId: number, reg: number, text: string): Observable<Narrative> {
    return this.api.put(`/panel/me/stages/${stageId}/students/${reg}/narrative`, { text });
  }
  approveNarrative(stageId: number, reg: number): Observable<Narrative> {
    return this.api.post(`/panel/me/stages/${stageId}/students/${reg}/narrative/approve`);
  }
}

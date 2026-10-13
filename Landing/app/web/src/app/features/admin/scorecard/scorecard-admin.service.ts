import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface FrameworkDimension {
  key: string;
  label: string;
  subtitle?: string;
  description?: string;
}

export interface FrameworkLevel {
  key: string;
  label: string;
  points: number;
  minPercent: number;
  minAverage?: number | null;
  meaning: string;
  color?: string;
}

export interface FrameworkScale {
  key: string;
  name: string;
  levels: FrameworkLevel[];
  movingTowardsMargin?: number | null;
}

export interface FrameworkCompetency {
  key: string;
  name: string;
  description?: string;
  dimension: string;
  weight: number;
  stageNames: Record<string, string>;
  examCategories?: string[];
}

export interface FrameworkConfig {
  dimensions: FrameworkDimension[];
  scales: FrameworkScale[];
  defaultScale: string;
  competencies: FrameworkCompetency[];
  autoScore?: { minQuestionsPerArea: number };
  /** How the stages roll up into the final profile (#84); edited as rules, see the Final profile rules tab. */
  rollup?: Record<string, unknown>;
}

export type FrameworkStatus = 'Draft' | 'Published' | 'Archived';

export interface FrameworkRow {
  code: string;
  name: string;
  version: number;
  status: FrameworkStatus;
  publishedAt: string | null;
  updatedAt: string;
  dimensions: number;
  scales: number;
  competencies: number;
  seasons: number;
  issues: number;
}

export interface FrameworkDetail {
  code: string;
  name: string;
  version: number;
  status: FrameworkStatus;
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  config: FrameworkConfig;
  issues: string[];
  locked: boolean;
  versions: { code: string; name: string; version: number; status: FrameworkStatus }[];
  seasons: { code: string; name: string }[];
}

export interface SeasonRow {
  code: string;
  name: string;
  editionLabel: string;
  idPattern: string;
  idExample: string;
  year: number | null;
  active: boolean;
  scaleKey: string | null;
  library: { code: string; name: string } | null;
  template: { code: string; name: string; version: number; status: string } | null;
  deliverySettings: DeliverySettings;
  effectiveScale: string;
  framework: { code: string; name: string; version: number; status: FrameworkStatus };
  scaleOptions: { key: string; name: string }[];
  competitions: { code: string; title: string; scaleKey: string | null }[];
}

export interface DeliverySettings {
  consentRequired: boolean;
  notifyStudent: boolean;
  linkValidDays: number;
}

export interface ConfigChange {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
}

export interface ConfigDiff {
  from: { code: string; name: string; version: number; status: string };
  to: { code: string; name: string; version: number; status: string };
  changes: ConfigChange[];
}

export interface AuditPage {
  total: number;
  items: AuditRow[];
  entities: string[];
  actions: string[];
}

export interface ImportCheck {
  dryRun: boolean;
  framework: string;
  template: string | null;
  libraryTexts: number;
  problems: string[];
  created?: { framework: string; template: string | null; library: string | null };
}

export interface AuditRow {
  id: number;
  entity: string;
  entityCode: string | null;
  action: string;
  adminName: string | null;
  summary: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------- content library (#72)

export interface TextKindInfo {
  key: string;
  label: string;
  help: string;
  scope: 'competency' | 'dimension' | 'stage' | 'none';
  byLevel: boolean;
  ordered: boolean;
  titled: boolean;
}

export interface ContentMeta {
  kinds: TextKindInfo[];
  placeholders: { token: string; help: string }[];
  wildcard: string;
}

export interface LibraryRow {
  code: string;
  name: string;
  notes: string | null;
  defaultLanguage: string;
  languages: string[];
  updatedAt: string;
  counts: { total: number; approved: number; changed: number; draft: number };
  seasons: { code: string; name: string }[];
}

export type TextState = 'draft' | 'approved' | 'changed' | 'withdrawn';

export interface TextRow {
  id: number;
  kind: string;
  key: string;
  levelKey: string;
  language: string;
  position: number;
  title: string | null;
  text: string;
  state: TextState;
  approvedVersion: number | null;
  approvedText: string | null;
  approvedTitle: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface TextVersionRow {
  version: number;
  title: string | null;
  text: string;
  approvedAt: string;
  approvedByName: string | null;
  note: string | null;
  live: boolean;
}

export interface CoverageCell {
  key: string;
  keyLabel: string;
  level: string;
  levelLabel: string;
  state: 'approved' | 'default' | 'draft' | 'missing';
}

export interface CoverageKind {
  kind: string;
  label: string;
  scope: string;
  byLevel: boolean;
  ordered: boolean;
  cells: CoverageCell[];
  approved: number;
  defaulted: number;
  draft: number;
  missing: number;
}

export interface CoverageResponse {
  library: string;
  framework: { code: string; name: string; version: number; status: string };
  language: string;
  scale: { key: string; name: string } | null;
  kinds: CoverageKind[];
}

export interface ImportResult {
  dryRun: boolean;
  rows: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: { row: number; message: string }[];
}

export interface SaveTextBody {
  kind: string;
  key?: string;
  levelKey?: string;
  language?: string;
  position?: number;
  title?: string;
  text: string;
}

export interface SampleValues {
  name?: string;
  gender?: string;
  dimension?: string;
  competency?: string;
  levelLabel?: string;
  edition?: string;
  stage?: string;
  competition?: string;
}

export interface TemplatePreview {
  problems: string[];
  text: string;
  missing: string[];
}

export interface WordingPreview {
  source: 'exact' | 'default' | 'language_fallback' | 'default_language_fallback' | 'missing';
  note: string | null;
  approvedOnly: boolean;
  item?: { title: string | null; text: string; missing: string[]; version: number | null } | null;
  items?: { position: number; title: string | null; text: string; missing: string[] }[];
}

// ---------------------------------------------------------------- report templates and PDFs (#73)

export interface SectionTypeInfo {
  type: string;
  label: string;
  help: string;
  stage: boolean;
  labels: { key: string; label: string; help?: string }[];
}

export interface TemplateSectionCfg {
  key: string;
  type: string;
  enabled: boolean;
  pageBreakBefore?: boolean;
  stage?: number;
  labels: Record<string, string>;
  percentDecimals?: number;
  audiences?: string[];
}

export interface TemplateBranding {
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  highlightColor: string;
  stageColors: Record<string, string>;
  levelColors: Record<string, string>;
  footerText?: string;
}

export interface TemplateConfigCfg {
  branding: TemplateBranding;
  sections: TemplateSectionCfg[];
}

export interface TemplateRow {
  code: string;
  name: string;
  version: number;
  status: FrameworkStatus;
  sections: number;
  issues: number;
  seasons: { code: string; name: string }[];
  updatedAt: string;
}

export interface TemplateDetail {
  code: string;
  name: string;
  version: number;
  status: FrameworkStatus;
  notes: string | null;
  publishedAt: string | null;
  updatedAt: string;
  locked: boolean;
  config: TemplateConfigCfg;
  issues: string[];
  seasons: { code: string; name: string }[];
  versions: { code: string; version: number; status: string; name: string }[];
}

export interface ReportInfo {
  id: number;
  code: string;
  version: number;
  status: 'Queued' | 'Generating' | 'Ready' | 'Failed';
  attempts: number;
  error: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  pages: number | null;
  generatedAt: string | null;
  superseded: boolean;
  releasedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawnReason?: string | null;
  gaps: number;
  fallbacks: number;
}

export interface ReleaseInfo {
  state: 'Not released' | 'Released' | 'Withdrawn';
  version: number | null;
  releasedAt: string | null;
  withdrawnReason: string | null;
  /** The version of a newer report that is ready but not yet released. */
  awaiting: number | null;
}

export interface ParentLinkInfo {
  state: 'ok' | 'expired' | 'revoked' | 'locked';
  expiresAt: string;
  openCount: number;
  lastOpenedAt: string | null;
  sentAt: string;
}

export interface ReleaseResult {
  released: number;
  notified: number;
  skipped: { student: string; reason: string }[];
  skippedCount: number;
}

export interface ReportListRow {
  student: { code: string; name: string; grade: string; school: string | null; hasParentPhone: boolean };
  release: ReleaseInfo;
  consent: { parent: boolean; school: boolean };
  parentLink: ParentLinkInfo | null;
  report: ReportInfo | null;
  pending: ReportInfo | null;
  versions: number;
}

export interface ReportList {
  competition: { code: string; title: string };
  stage: { position: number; name: string };
  summary: { students: number; ready: number; queued: number; generating: number; failed: number; none: number; released: number; withdrawn: number; toRelease: number };
  total: number;
  page: number;
  limit: number;
  rows: ReportListRow[];
}

export interface ReportDetail extends ReportInfo {
  competition: { code: string; title: string };
  student: { code: string; name: string };
  stage: number;
  configUsed: {
    framework?: { code: string; version: number };
    template?: { code: string; version: number };
    library?: { code: string; language: string };
    season?: string | null;
    scale?: string;
    attempt?: string | null;
    texts?: { kind: string; key: string; levelKey: string; version: number }[];
  } | null;
  warnings: { gaps?: string[]; fallbacks?: string[] } | null;
  requestedByName: string | null;
  createdAt: string;
  versions: { id: number; version: number; status: string; code: string; generatedAt: string | null; superseded: boolean; release: 'Not released' | 'Released' | 'Withdrawn' }[];
}

export interface ReportPreview {
  html: string;
  gaps: string[];
  fallbacks: string[];
  template: { code: string; version: number; status: string; issues: string[] };
  library: string;
  framework: { code: string; name: string; version: number };
  draftWording: boolean;
}

function cleanParams(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

export function errText(e: unknown): string {
  const m = (e as { error?: { message?: string | string[] }; message?: string })?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? (e as { message?: string })?.message ?? 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class ScorecardAdminApi {
  private readonly api = inject(ApiService);

  frameworks(): Observable<FrameworkRow[]> {
    return this.api.get('/scorecard/frameworks');
  }
  framework(code: string): Observable<FrameworkDetail> {
    return this.api.get(`/scorecard/frameworks/${code}`);
  }
  createFramework(body: { name: string; notes?: string; cloneFrom?: string }): Observable<FrameworkDetail> {
    return this.api.post('/scorecard/frameworks', body);
  }
  updateFramework(code: string, body: { name?: string; notes?: string; config?: FrameworkConfig }): Observable<FrameworkDetail> {
    return this.api.patch(`/scorecard/frameworks/${code}`, body);
  }
  deleteFramework(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/scorecard/frameworks/${code}`);
  }
  publish(code: string): Observable<FrameworkDetail> {
    return this.api.post(`/scorecard/frameworks/${code}/publish`);
  }
  archive(code: string): Observable<FrameworkDetail> {
    return this.api.post(`/scorecard/frameworks/${code}/archive`);
  }
  unarchive(code: string): Observable<FrameworkDetail> {
    return this.api.post(`/scorecard/frameworks/${code}/unarchive`);
  }

  seasons(): Observable<SeasonRow[]> {
    return this.api.get('/scorecard/seasons');
  }
  createSeason(body: Record<string, unknown>): Observable<SeasonRow> {
    return this.api.post('/scorecard/seasons', body);
  }
  updateSeason(code: string, body: Record<string, unknown>): Observable<SeasonRow> {
    return this.api.patch(`/scorecard/seasons/${code}`, body);
  }
  deleteSeason(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/scorecard/seasons/${code}`);
  }
  setSeasonCompetitions(code: string, competitions: { competitionCode: string; scaleKey?: string }[]): Observable<SeasonRow> {
    return this.api.put(`/scorecard/seasons/${code}/competitions`, { competitions });
  }
  competitions(): Observable<{ data: { code: string; title: string; status: string }[] }> {
    return this.api.get('/competitions', { limit: 200 });
  }

  stageRoster(f: StageFilters, page: number, limit = 25): Observable<RosterResponse> {
    return this.api.get('/scorecard/stage-report/roster', cleanParams({ ...f, page, limit }));
  }
  stageReport(comp: string, stage: number, student: string, framework?: string): Observable<StageStudentReport> {
    return this.api.get('/scorecard/stage-report', cleanParams({ comp, stage, student, framework }));
  }
  stages(comp: string): Observable<{ position: number; name: string; mode: string }[]> {
    return this.api.get(`/competitions/${comp}/stages`);
  }
  exportRoster(f: StageFilters): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob('/scorecard/stage-report/roster/export', cleanParams({ ...f })).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${f.comp}-stage-${f.stage}-report.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }

  // ---- content library
  contentMeta(): Observable<ContentMeta> {
    return this.api.get('/scorecard/content/meta');
  }
  libraries(): Observable<LibraryRow[]> {
    return this.api.get('/scorecard/content/libraries');
  }
  library(code: string): Observable<LibraryRow> {
    return this.api.get(`/scorecard/content/libraries/${code}`);
  }
  createLibrary(body: { name: string; notes?: string; defaultLanguage?: string; languages?: string[]; cloneFrom?: string }): Observable<LibraryRow> {
    return this.api.post('/scorecard/content/libraries', body);
  }
  updateLibrary(code: string, body: { name?: string; notes?: string; defaultLanguage?: string; languages?: string[] }): Observable<LibraryRow> {
    return this.api.patch(`/scorecard/content/libraries/${code}`, body);
  }
  deleteLibrary(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/scorecard/content/libraries/${code}`);
  }
  texts(code: string, f: { kind?: string; language?: string; state?: string; search?: string }): Observable<{ total: number; items: TextRow[] }> {
    return this.api.get(`/scorecard/content/libraries/${code}/texts`, cleanParams({ ...f }));
  }
  saveText(code: string, body: SaveTextBody): Observable<TextRow> {
    return this.api.put(`/scorecard/content/libraries/${code}/texts`, body);
  }
  deleteText(code: string, id: number): Observable<{ ok: boolean }> {
    return this.api.delete(`/scorecard/content/libraries/${code}/texts/${id}`);
  }
  approveText(code: string, id: number, note?: string): Observable<TextRow> {
    return this.api.post(`/scorecard/content/libraries/${code}/texts/${id}/approve`, { note });
  }
  approveAll(code: string, body: { kind?: string; language?: string; note?: string }): Observable<{ approved: number }> {
    return this.api.post(`/scorecard/content/libraries/${code}/texts/approve-all`, body);
  }
  revertText(code: string, id: number): Observable<TextRow> {
    return this.api.post(`/scorecard/content/libraries/${code}/texts/${id}/revert`);
  }
  withdrawText(code: string, id: number): Observable<TextRow> {
    return this.api.post(`/scorecard/content/libraries/${code}/texts/${id}/withdraw`);
  }
  textVersions(code: string, id: number): Observable<TextVersionRow[]> {
    return this.api.get(`/scorecard/content/libraries/${code}/texts/${id}/versions`);
  }
  importTexts(code: string, csv: string, dryRun: boolean): Observable<ImportResult> {
    return this.api.post(`/scorecard/content/libraries/${code}/import`, { csv, dryRun });
  }
  exportTexts(code: string, language?: string): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob(`/scorecard/content/libraries/${code}/export`, cleanParams({ language })).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${code}-wording.csv`;
          a.click();
          URL.revokeObjectURL(url);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }
  coverage(code: string, framework: string, language?: string): Observable<CoverageResponse> {
    return this.api.get(`/scorecard/content/libraries/${code}/coverage`, cleanParams({ framework, language }));
  }
  previewTemplate(body: SampleValues & { text: string }): Observable<TemplatePreview> {
    return this.api.post('/scorecard/content/preview-template', body);
  }
  previewWording(code: string, body: SampleValues & { kind: string; key?: string; level?: string; language?: string; position?: number; draft?: boolean }): Observable<WordingPreview> {
    return this.api.post(`/scorecard/content/libraries/${code}/preview`, body);
  }

  // ---- report templates and PDFs
  templateMeta(): Observable<{ sectionTypes: SectionTypeInfo[] }> {
    return this.api.get('/scorecard/templates/meta');
  }
  templates(): Observable<TemplateRow[]> {
    return this.api.get('/scorecard/templates');
  }
  template(code: string): Observable<TemplateDetail> {
    return this.api.get(`/scorecard/templates/${code}`);
  }
  createTemplate(body: { name: string; notes?: string; cloneFrom?: string }): Observable<TemplateDetail> {
    return this.api.post('/scorecard/templates', body);
  }
  updateTemplate(code: string, body: { name?: string; notes?: string; config?: TemplateConfigCfg }): Observable<TemplateDetail> {
    return this.api.patch(`/scorecard/templates/${code}`, body);
  }
  deleteTemplate(code: string): Observable<{ ok: boolean }> {
    return this.api.delete(`/scorecard/templates/${code}`);
  }
  publishTemplate(code: string): Observable<TemplateDetail> {
    return this.api.post(`/scorecard/templates/${code}/publish`);
  }
  archiveTemplate(code: string): Observable<TemplateDetail> {
    return this.api.post(`/scorecard/templates/${code}/archive`);
  }
  unarchiveTemplate(code: string): Observable<TemplateDetail> {
    return this.api.post(`/scorecard/templates/${code}/unarchive`);
  }

  reports(comp: string, stage: number, f: { search?: string; status?: string; page?: number; limit?: number }): Observable<ReportList> {
    return this.api.get('/scorecard/reports', cleanParams({ comp, stage, ...f }));
  }
  generateReports(comp: string, stage: number, body: { students?: string[]; regenerate?: boolean }): Observable<{ queued: number; requeued: number; skipped: number }> {
    return this.api.post(`/scorecard/reports/generate?comp=${encodeURIComponent(comp)}&stage=${stage}`, body);
  }
  report(id: number): Observable<ReportDetail> {
    return this.api.get(`/scorecard/reports/${id}`);
  }
  releaseReports(comp: string, body: { stage?: number; students?: string[]; force?: boolean }): Observable<ReleaseResult> {
    return this.api.post(`/scorecard/reports/release?comp=${encodeURIComponent(comp)}`, body);
  }
  withdrawReports(comp: string, body: { stage?: number; students?: string[]; reason?: string }): Observable<{ withdrawn: number; linksRevoked: number }> {
    return this.api.post(`/scorecard/reports/withdraw?comp=${encodeURIComponent(comp)}`, body);
  }
  sendReportsToParents(comp: string, body: { stage: number; students?: string[] }): Observable<{ sent: number; skipped: { student: string; reason: string }[]; skippedCount: number }> {
    return this.api.post(`/scorecard/reports/send-parents?comp=${encodeURIComponent(comp)}`, body);
  }
  retryReport(id: number): Observable<ReportDetail> {
    return this.api.post(`/scorecard/reports/${id}/retry`);
  }
  reportPreview(p: { comp: string; stage: number; student: string; template?: string; library?: string; framework?: string; draft?: boolean }): Observable<ReportPreview> {
    return this.api.get('/scorecard/reports/preview', cleanParams({ ...p, draft: p.draft ? 'true' : undefined }));
  }
  /** Opens a PDF (the preview, or an issued report) in a new tab, or saves it. */
  openPdf(path: string, params: Record<string, unknown>, filename: string, save: boolean): Observable<void> {
    return new Observable<void>((sub) => {
      this.api.downloadBlob(path, cleanParams(params)).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          if (save) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
          } else window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }

  frameworkDiff(code: string, against?: string): Observable<ConfigDiff> {
    return this.api.get(`/scorecard/frameworks/${code}/diff`, cleanParams({ against }));
  }
  templateDiff(code: string, against?: string): Observable<ConfigDiff> {
    return this.api.get(`/scorecard/templates/${code}/diff`, cleanParams({ against }));
  }
  exportSeason(season: string): Observable<unknown> {
    return this.api.get('/scorecard/export', { season });
  }
  importBundle(bundle: unknown, dryRun: boolean): Observable<ImportCheck> {
    return this.api.post('/scorecard/import', { bundle, dryRun });
  }
  copySeason(code: string, body: { name: string; editionLabel: string; year?: number }): Observable<{ season: string; library: string | null; note: string | null }> {
    return this.api.post(`/scorecard/seasons/${code}/copy`, body);
  }
  auditSearch(q: { entity?: string; code?: string; action?: string; admin?: string; from?: string; to?: string; limit?: number; offset?: number }): Observable<AuditPage> {
    return this.api.get('/scorecard/audit/search', cleanParams(q));
  }

  audit(entity: string, code: string): Observable<AuditRow[]> {
    return this.api.get('/scorecard/audit', { entity, code, limit: 30 });
  }
}

export function standardEdpaScale(): FrameworkScale {
  return {
    key: 'EDPA',
    name: 'IML Development Scale',
    movingTowardsMargin: 0.25,
    levels: [
      { key: 'EMERGING', label: 'Emerging', points: 1, minPercent: 0, minAverage: 1, meaning: 'Beginning to demonstrate the competency.' },
      { key: 'DEVELOPING', label: 'Developing', points: 2, minPercent: 40, minAverage: 1.75, meaning: 'Demonstrates the competency in familiar situations but needs greater consistency.' },
      { key: 'PROFICIENT', label: 'Proficient', points: 3, minPercent: 60, minAverage: 2.5, meaning: 'Demonstrates the competency effectively across different situations.' },
      { key: 'ADVANCED', label: 'Advanced', points: 4, minPercent: 80, minAverage: 3.5, meaning: 'Demonstrates maturity, adaptability and depth while applying the competency.' },
    ],
  };
}

// ---------------------------------------------------------------- stage report (#71)

export interface ReportLevel {
  key: string;
  label: string;
  points: number;
  minPercent: number;
  meaning: string;
}

export interface AreaResult {
  competency: string;
  name: string;
  categories: string[];
  correct: number;
  total: number;
  percent: number | null;
  level: ReportLevel | null;
  status: 'ok' | 'not_enough_questions' | 'no_questions';
}

export interface DimensionResult {
  dimension: string;
  label: string;
  subtitle?: string;
  overall: { correct: number; total: number; percent: number; level: ReportLevel | null } | null;
  areas: AreaResult[];
}

export interface StageStudentReport {
  competition: { code: string; title: string };
  stage: { position: number; name: string };
  framework: { code: string; name: string; version: number; status: string };
  season: { code: string; name: string; editionLabel: string } | null;
  scale: { key: string; name: string; levels: ReportLevel[] };
  student: { code: string; name: string; grade: string; gender: string | null; school: string | null; schoolCode: string | null } | null;
  status: 'ready' | 'in_progress' | 'not_attempted';
  attempt: { code: string; finishedAt: string; score: number; total: number } | null;
  report: {
    dimensions: DimensionResult[];
    unmapped: { category: string; correct: number; total: number }[];
    totals: { correct: number; total: number; percent: number | null };
    minQuestionsPerArea: number;
  } | null;
}

export interface RosterRow {
  student: { code: string; name: string; grade: string; school: string | null; schoolCode: string | null };
  attemptCode: string;
  finishedAt: string;
  areas: Record<string, { percent: number | null; level: string | null; correct: number; total: number; status: string }>;
  dimensions: Record<string, { percent: number | null; level: string | null }>;
  unmapped: number;
}

export interface RosterResponse {
  competition: { code: string; title: string };
  stage: { position: number; name: string };
  framework: { code: string; name: string; version: number; status: string };
  scale: { key: string; name: string; levels: ReportLevel[] };
  minQuestionsPerArea: number;
  columns: {
    areas: { competency: string; dimension: string; name: string; categories: string[] }[];
    dimensions: { key: string; label: string }[];
  };
  rows: RosterRow[];
  total: number;
  page: number;
  limit: number;
}

export interface StageFilters {
  comp: string;
  stage: number;
  framework?: string;
  search?: string;
  grade?: string;
  school?: string;
}

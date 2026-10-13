// A starting report template built from the client's sample Future Readiness report: the
// Stage 1 report (cover, introduction, level scale, stage results, strengths and growth text,
// bar profile, important note, verification). Idempotent; created as a DRAFT so an admin can
// review the layout, set the logo, and publish it. Everything here is data an admin edits in
// Scorecard Setup -> Report templates.
import { PrismaClient } from '@prisma/client';
import { TemplateConfig } from '../common/report-template';

export const SAMPLE_TEMPLATE_NAME = 'Future Readiness report – Stage 1 (from client sample)';

export const SAMPLE_TEMPLATE_CONFIG: TemplateConfig = {
  branding: {
    primaryColor: '#1d3557',
    accentColor: '#9b1c31',
    highlightColor: '#c28a16',
    stageColors: { '1': '#1d3557', '2': '#9b1c31', '3': '#c28a16', '4': '#2d6a4f' },
    levelColors: { EMERGING: '#9b1c31', DEVELOPING: '#c28a16', PROFICIENT: '#1d3557', ADVANCED: '#2d6a4f' },
    footerText: 'India Mind League · Future Readiness Report',
  },
  sections: [
    {
      key: 'cover',
      type: 'cover',
      enabled: true,
      labels: {
        title: 'INDIA MIND LEAGUE',
        subtitle: 'FUTURE READINESS REPORT',
        tagline: 'THINK  •  FEEL  •  CONNECT  •  LEAD',
        name: 'Student name',
        grade: 'Grade',
        school: 'School',
        id: 'Student ID',
        edition: 'Edition',
      },
    },
    { key: 'intro', type: 'intro', enabled: true, labels: { title: 'Your IML Future Readiness profile' } },
    { key: 'level_scale', type: 'level_scale', enabled: true, labels: { title: 'IML development scale', colLevel: 'Level', colMeaning: 'Meaning' } },
    {
      key: 'stage1_results',
      type: 'stage_results',
      stage: 1,
      enabled: true,
      pageBreakBefore: true,
      percentDecimals: 0,
      labels: {
        title: 'Stage 1 — {Stage}',
        areasHeading: 'Assessment areas',
        colArea: 'Area',
        colScore: 'Score',
        colLevel: 'Level',
        overall: 'OVERALL {Dimension} SCORE',
        notEnough: 'Not enough questions to score this area',
      },
    },
    {
      key: 'stage1_narrative',
      type: 'narrative',
      stage: 1,
      enabled: true,
      labels: { strength: 'Your {Dimension} strengths', growth: 'Development opportunity', practice: 'Build your {Dimension} intelligence' },
    },
    { key: 'stage1_bars', type: 'bar_profile', stage: 1, enabled: true, percentDecimals: 0, labels: { title: 'Your score profile' } },
    { key: 'note', type: 'disclaimer', enabled: true, labels: { title: 'Important note' } },
    {
      key: 'verification',
      type: 'verification',
      enabled: true,
      labels: { title: 'Verify this report', caption: 'Scan the code, or enter the report code on the IML website, to confirm this report is genuine.', codeLabel: 'Report code' },
    },
  ],
};

export async function seedReportTemplate(prisma: PrismaClient) {
  const existing = await prisma.scorecardTemplate.findFirst({ where: { name: SAMPLE_TEMPLATE_NAME } });
  if (existing) return { created: false, code: existing.code };
  let max = 0;
  for (const t of await prisma.scorecardTemplate.findMany({ select: { code: true } })) {
    const m = t.code.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const code = `TP${max + 1}`;
  await prisma.scorecardTemplate.create({
    data: { code, name: SAMPLE_TEMPLATE_NAME, status: 'Draft', notes: 'Built from the client sample report. Review the layout, add the logo, then publish.', config: SAMPLE_TEMPLATE_CONFIG as never },
  });
  return { created: true, code };
}

export const FULL_TEMPLATE_NAME = 'Future Readiness full scorecard – all stages (from client sample)';

const stageResults = (n: number, title: string) => ({ key: `stage${n}_results`, type: 'stage_results' as const, stage: n, enabled: true, pageBreakBefore: true, percentDecimals: 0, labels: { title, areasHeading: 'Assessment areas', colArea: 'Area', colScore: 'Score', colLevel: 'Level', overall: 'OVERALL {Dimension} SCORE', notEnough: 'Not enough questions to score this area' } });
const stageComps = (n: number, title: string) => ({ key: `stage${n}_competencies`, type: 'stage_competencies' as const, stage: n, enabled: true, pageBreakBefore: true, labels: { title, colCompetency: 'Competency', colLevel: 'Level' } });
const stageNote = (n: number, title: string) => ({ key: `stage${n}_note`, type: 'observer_note' as const, stage: n, enabled: true, labels: { title } });
const stageSnap = (n: number) => ({ key: `stage${n}_snapshot`, type: 'snapshot' as const, stage: n, enabled: true, labels: { title: '{Stage} snapshot', strength: 'Strength', growth: 'Growth area', reflection: 'Reflection' } });

// The whole scorecard of the client's sample: cover, profile summary, level scale, a section per
// stage (online results, observed competencies with observer / jury notes and a snapshot, a scored
// written assessment), the complete profile, the 30-day challenge, reflection questions, ancient
// wisdom, mantra, important note and verification. Sections of a stage that is pending or never
// reached are left out of a student's report automatically.
export const FULL_TEMPLATE_CONFIG: TemplateConfig = {
  branding: SAMPLE_TEMPLATE_CONFIG.branding,
  sections: [
    SAMPLE_TEMPLATE_CONFIG.sections[0],
    { key: 'intro', type: 'intro', enabled: true, labels: { title: 'Your IML Future Readiness profile' } },
    { key: 'summary', type: 'profile_summary', enabled: true, labels: { title: 'Your profile at a glance', colDimension: 'Dimension', colLevel: 'Level', overall: 'Overall Future Readiness level', oneLine: 'Your profile in one line', provisional: 'Some stages are still being completed, so this profile may change.' } },
    { key: 'level_scale', type: 'level_scale', enabled: true, labels: { title: 'IML development scale', colLevel: 'Level', colMeaning: 'Meaning' } },
    stageResults(1, 'Stage 1 — {Stage}'),
    { key: 'stage1_narrative', type: 'narrative', stage: 1, enabled: true, labels: { strength: 'Your {Dimension} strengths', growth: 'Development opportunity', practice: 'Build your {Dimension} intelligence' } },
    { key: 'stage1_bars', type: 'bar_profile', stage: 1, enabled: true, percentDecimals: 0, labels: { title: 'Your score profile' } },
    stageComps(2, 'Stage 2 — {Stage}'),
    stageNote(2, 'Observer interpretation'),
    stageSnap(2),
    stageComps(3, 'Stage 3 — {Stage}'),
    { key: 'dimension_notes', type: 'dimension_notes', enabled: true, labels: { title: 'Bootcamp observations', line: '{Dimension} – {Level}: ' } },
    { key: 'style', type: 'leadership_style', enabled: true, labels: { title: 'Your leadership style' } },
    { key: 'stage3_written', type: 'assessment_areas', stage: 3, enabled: true, percentDecimals: 0, labels: { title: 'Written assessment', colArea: 'Assessment area', colScore: 'Score', colLevel: 'Level', overall: 'Overall written assessment' } },
    stageComps(4, 'Stage 4 — {Stage}'),
    stageNote(4, 'Jury observation'),
    { key: 'complete', type: 'final_profile', enabled: true, pageBreakBefore: true, labels: { title: 'Your complete IML profile', colDimension: 'Dimension', colLevel: 'Final level', colReflects: 'What it reflects', strengths: 'Your top strengths', growth: 'Your growth opportunities' } },
    { key: 'statement', type: 'statement', enabled: true, labels: { title: 'Future readiness statement' } },
    { key: 'challenge', type: 'challenge', enabled: true, pageBreakBefore: true, labels: { title: 'Your 30-day Future Readiness challenge', colWeek: 'Week', colFocus: 'Focus', colPractice: 'Practice', week: 'Week {n}' } },
    { key: 'reflection', type: 'reflection', enabled: true, labels: { title: 'Questions for self-reflection' } },
    { key: 'wisdom', type: 'wisdom', enabled: true, labels: { title: 'From ancient wisdom to future readiness', intro: 'IML views human development through four interconnected capacities:', colCapacity: 'Capacity', colDimension: 'IML dimension', colMeaning: 'Meaning' } },
    { key: 'mantra', type: 'mantra', enabled: true, labels: { title: 'IML mantra' } },
    SAMPLE_TEMPLATE_CONFIG.sections[SAMPLE_TEMPLATE_CONFIG.sections.length - 2],
    SAMPLE_TEMPLATE_CONFIG.sections[SAMPLE_TEMPLATE_CONFIG.sections.length - 1],
  ],
};

export async function seedFullReportTemplate(prisma: PrismaClient) {
  const existing = await prisma.scorecardTemplate.findFirst({ where: { name: FULL_TEMPLATE_NAME } });
  if (existing) return { created: false, code: existing.code };
  let max = 0;
  for (const t of await prisma.scorecardTemplate.findMany({ select: { code: true } })) {
    const m = t.code.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const code = `TP${max + 1}`;
  await prisma.scorecardTemplate.create({
    data: { code, name: FULL_TEMPLATE_NAME, status: 'Draft', notes: 'The full scorecard of the client sample, all four stages. Review the layout, then publish.', config: FULL_TEMPLATE_CONFIG as never },
  });
  return { created: true, code };
}

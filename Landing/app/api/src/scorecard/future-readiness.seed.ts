import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_MIN_QUESTIONS_PER_AREA, FrameworkCompetency, FrameworkConfig, standardEdpaScale } from '../common/scorecard-config';

// A ready-made DRAFT framework built from the competencies in the client's sample
// Future Readiness report, so admins start from the real structure instead of a
// blank page. The competency-to-dimension mapping and the weights are OUR PROPOSAL
// drawn from the names — the client must approve them (tracker #67) — which is why
// it is created as a Draft with that note. Setup-only and idempotent: if a
// framework with this name exists it does nothing, and it never touches published
// configuration.

export const SAMPLE_FRAMEWORK_NAME = 'IML Future Readiness Framework (draft from client sample)';

const c = (key: string, name: string, dimension: string, stageNames: Record<string, string> = {}, examCategories?: string[]): FrameworkCompetency => ({
  key,
  name,
  dimension,
  weight: 1,
  stageNames,
  ...(examCategories ? { examCategories } : {}),
});

export const SAMPLE_CONFIG: FrameworkConfig = {
  dimensions: [
    { key: 'THINK', label: 'THINK', subtitle: 'Intellectual Intelligence', description: 'Discern, analyse and make wise choices (Buddhi).' },
    { key: 'FEEL', label: 'FEEL', subtitle: 'Emotional Intelligence', description: 'Understand and regulate emotions (Bhava).' },
    { key: 'CONNECT', label: 'CONNECT', subtitle: 'Social Intelligence', description: 'Build meaningful relationships and understand others (Sambandh).' },
    { key: 'LEAD', label: 'LEAD', subtitle: 'Leadership Intelligence', description: 'Translate understanding into responsible action (Karma).' },
  ],
  scales: [standardEdpaScale()],
  defaultScale: 'EDPA',
  autoScore: { minQuestionsPerArea: DEFAULT_MIN_QUESTIONS_PER_AREA },
  // The roll-up rules of the final profile (#84): equal stage and dimension weights, the rule the
  // sample implies for the leadership style, five strengths and three growth areas. These are a
  // PROPOSAL for the client to approve (tracker #67); the second style is a placeholder fallback.
  rollup: {
    stageWeights: {},
    dimensionWeights: {},
    minItemsPerDimension: 1,
    minDimensionsForOverall: 1,
    competencyMap: {},
    topStrengths: 5,
    topGrowth: 3,
    styles: [
      { key: 'THOUGHTFUL_INITIATOR', name: 'The Thoughtful Initiator', conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }, { dimension: 'LEAD', atLeast: 'ADVANCED' }] },
      { key: 'DEVELOPING_LEADER', name: 'The Developing Leader', conditions: [{ dimension: 'LEAD', atMost: 'DEVELOPING' }] },
    ],
    fallbackStyle: 'DEVELOPING_LEADER',
    profileLines: [{ position: 1, conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }] }],
    fallbackProfileLine: 1,
    stageSources: {},
  },
  competencies: [
    // THINK
    // Stage 1 areas: scored from the exam's question categories (LR, DI, PR, GK).
    c('LOGICAL_REASONING', 'Logical Reasoning', 'THINK', {}, ['LR']),
    c('DATA_INTERPRETATION', 'Data Interpretation', 'THINK', {}, ['DI']),
    c('PATTERN_RECOGNITION', 'Pattern Recognition', 'THINK', {}, ['PR']),
    c('INDIA_AWARENESS', 'India Awareness', 'THINK', {}, ['GK']),
    c('CRITICAL_THINKING', 'Critical Thinking', 'THINK', { '4': 'Critical Reasoning' }),
    c('PROBLEM_SOLVING', 'Problem Solving', 'THINK'),
    c('UNDERSTANDING_COMPLEXITY', 'Understanding Complexity', 'THINK'),
    // FEEL
    c('EMOTIONAL_AWARENESS', 'Emotional Awareness', 'FEEL'),
    c('SELF_AWARENESS', 'Self-Awareness', 'FEEL'),
    c('EMOTIONAL_REGULATION', 'Emotional Regulation', 'FEEL'),
    c('EMOTIONAL_MATURITY', 'Emotional Maturity', 'FEEL'),
    c('CONFIDENCE_UNDER_PRESSURE', 'Confidence Under Pressure', 'FEEL'),
    // CONNECT
    c('EMPATHY', 'Empathy', 'CONNECT'),
    c('PERSPECTIVE_TAKING', 'Perspective Taking', 'CONNECT'),
    c('LISTENING', 'Listening', 'CONNECT'),
    c('COLLABORATION', 'Collaboration', 'CONNECT'),
    c('COMMUNICATION', 'Communication', 'CONNECT'),
    // LEAD
    c('DECISION_MAKING', 'Decision Making', 'LEAD', { '4': 'Decision-Making' }),
    c('RESPONSIBILITY', 'Responsibility', 'LEAD'),
    c('ACCOUNTABILITY', 'Accountability', 'LEAD'),
    c('ETHICAL_JUDGMENT', 'Ethical Judgment', 'LEAD', { '3': 'Ethical Decision-Making' }),
    c('INITIATIVE', 'Initiative', 'LEAD'),
    c('ADAPTABILITY', 'Adaptability', 'LEAD'),
    c('LEADERSHIP', 'Leadership', 'LEAD', { '2': 'Leadership Orientation', '4': 'Leadership Impact' }),
  ],
};

export async function seedFutureReadinessFramework(prisma: PrismaClient) {
  const existing = await prisma.scorecardFramework.findFirst({ where: { name: SAMPLE_FRAMEWORK_NAME } });
  if (existing) return { created: false, code: existing.code };

  const codes = (await prisma.scorecardFramework.findMany({ select: { code: true } })).map((x) => x.code);
  let max = 0;
  for (const code of codes) {
    const m = code.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const code = `FW${max + 1}`;
  await prisma.scorecardFramework.create({
    data: {
      code,
      name: SAMPLE_FRAMEWORK_NAME,
      status: 'Draft',
      notes:
        'Built from the competencies in the client sample report. The competency-to-dimension mapping and the weights are a proposal drawn from the names and must be approved by the client before publishing (tracker #67).',
      config: SAMPLE_CONFIG as unknown as Prisma.InputJsonValue,
    },
  });
  return { created: true, code };
}

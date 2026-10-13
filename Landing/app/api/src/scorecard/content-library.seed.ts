// The wording of the client's sample Future Readiness report, loaded as DRAFTS so an
// admin can review, edit and approve it (#72). Nothing is approved here: reports read
// only approved wording. Idempotent - it creates the library once and leaves it alone
// afterwards. Where the sample shows wording for one level only, it is placed at that
// level; the rest is for the client to write (see the coverage view).
import { PrismaClient } from '@prisma/client';

export const SAMPLE_LIBRARY_NAME = 'Future Readiness – sample wording (draft)';

interface Row {
  kind: string;
  key?: string;
  levelKey?: string;
  position?: number;
  title?: string;
  text: string;
}

const dimensionNotes: Row[] = [
  { kind: 'dimension_note', key: 'THINK', levelKey: 'ADVANCED', text: 'You approach challenges analytically and contribute useful ideas during problem-solving activities.' },
  { kind: 'dimension_note', key: 'FEEL', levelKey: 'PROFICIENT', text: 'You recognise emotions reasonably well, while emotional regulation under pressure remains an area to strengthen.' },
  { kind: 'dimension_note', key: 'CONNECT', levelKey: 'PROFICIENT', text: 'You collaborate constructively and respect the contributions of others. Actively seeking quieter or opposing viewpoints can deepen this strength.' },
  { kind: 'dimension_note', key: 'LEAD', levelKey: 'ADVANCED', text: 'You demonstrate initiative and are comfortable taking responsibility. Your next level is enabling others while continuing to move the group forward.' },
];

const reflects: Row[] = [
  { kind: 'dimension_reflects', key: 'THINK', levelKey: 'ADVANCED', text: 'Strong analytical reasoning, pattern recognition and problem solving.' },
  { kind: 'dimension_reflects', key: 'FEEL', levelKey: 'PROFICIENT', text: 'Healthy emotional awareness with growing regulation under pressure.' },
  { kind: 'dimension_reflects', key: 'CONNECT', levelKey: 'PROFICIENT', text: 'Empathy, listening and collaborative participation.' },
  { kind: 'dimension_reflects', key: 'LEAD', levelKey: 'ADVANCED', text: 'Initiative, responsibility and ability to translate decisions into action.' },
];

const rows: Row[] = [
  { kind: 'report_intro', text: 'India Mind League explores abilities that go beyond academic recall. This report provides a developmental snapshot of how you think, feel, connect and lead across different stages of the IML journey.' },
  { kind: 'profile_line', position: 1, text: 'A thoughtful problem-solver who demonstrates strong reasoning and leadership potential, with an opportunity to deepen emotional awareness and collaborative communication.' },
  { kind: 'stage_intro', key: '1', title: 'Intellectual Intelligence Profile', text: 'Stage 1 assesses how the student works with information, relationships, patterns and contextual knowledge through an online question-based assessment.' },
  { kind: 'stage_intro', key: '2', title: 'Behavioural Response & Judgment Profile', text: 'In the Live Showdown, the student responds to a real-life scenario under a defined time limit. The focus is not only on the answer, but on the reasoning, perspective and responsibility reflected in the response.' },
  { kind: 'stage_intro', key: '3', title: 'Applied Future Readiness Profile', text: 'Stage 3 evaluates how students apply their abilities in experiences involving people, pressure, teamwork, choices and reflection. It combines observed behaviour with written assessment.' },
  { kind: 'stage_intro', key: '4', title: 'Integrated Leadership Intelligence Profile', text: 'Stage 4 assesses the student’s ability to integrate THINK + FEEL + CONNECT + LEAD while responding to complex and unfamiliar challenges. The focus shifts from finding an answer to demonstrating judgment.' },
  { kind: 'dimension_strength', key: 'THINK', levelKey: 'PROFICIENT', text: 'You demonstrate a strong ability to identify relationships, recognise patterns and approach problems logically. Your responses suggest that you are comfortable breaking down information and looking for structure before arriving at a conclusion.' },
  { kind: 'dimension_growth', key: 'THINK', levelKey: 'PROFICIENT', text: 'Your profile suggests an opportunity to deepen your ability to interpret complex data and connect knowledge with contemporary Indian contexts.' },
  { kind: 'dimension_practice', key: 'THINK', text: 'Practise unfamiliar problems, interpret real-world data, question assumptions and connect facts with wider context.' },
  ...dimensionNotes,
  ...reflects,
  { kind: 'strength', key: 'LOGICAL_REASONING', levelKey: 'ADVANCED', title: 'Analytical Thinking', text: 'structures information and identifies logical relationships.' },
  { kind: 'strength', key: 'ETHICAL_JUDGMENT', levelKey: 'ADVANCED', title: 'Ethical Judgment', text: 'considers responsibility and consequences.' },
  { kind: 'strength', key: 'INITIATIVE', levelKey: 'ADVANCED', title: 'Initiative', text: 'is comfortable stepping forward and taking ownership.' },
  { kind: 'strength', key: 'PROBLEM_SOLVING', levelKey: 'ADVANCED', title: 'Problem Solving', text: 'approaches challenges with curiosity and determination.' },
  { kind: 'strength', key: 'COLLABORATION', levelKey: 'ADVANCED', title: 'Collaborative Leadership', text: 'contributes effectively while working with others.' },
  { kind: 'growth', key: 'EMOTIONAL_REGULATION', levelKey: 'DEVELOPING', title: 'Emotional Regulation Under Pressure', text: 'recognise the emotional response before acting.' },
  { kind: 'growth', key: 'PERSPECTIVE_TAKING', levelKey: 'PROFICIENT', title: 'Perspective Taking', text: 'deliberately ask how another person may see the same situation.' },
  { kind: 'growth', key: 'UNDERSTANDING_COMPLEXITY', levelKey: 'PROFICIENT', title: 'Comfort With Ambiguity', text: 'learn to evaluate options even when information is incomplete.' },
  { kind: 'statement', text: 'Knowledge may give you answers. Judgment helps you choose what to do with them.' },
  { kind: 'challenge', key: 'THINK', position: 1, title: 'THINK', text: 'Choose one news story daily. Ask: What happened? Why? What evidence supports it? What could happen next?' },
  { kind: 'challenge', key: 'FEEL', position: 2, title: 'FEEL', text: 'Pause daily and identify: What am I feeling? Why? How is it influencing my response?' },
  { kind: 'challenge', key: 'CONNECT', position: 3, title: 'CONNECT', text: 'Have one conversation each day where your goal is not to respond, but to understand.' },
  { kind: 'challenge', key: 'LEAD', position: 4, title: 'LEAD', text: 'Identify one problem around you and take one responsible action towards solving it.' },
  ...[
    'Do I change my opinion when better evidence appears?',
    'Can I disagree with someone without disrespecting them?',
    'Do I understand what I feel before reacting?',
    'Do I listen to understand or only to respond?',
    'When I make a decision, do I consider its impact on others?',
    'Can I take responsibility when something goes wrong?',
    'Can I lead myself even when nobody is watching?',
  ].map((text, i): Row => ({ kind: 'reflection', position: i + 1, text })),
  { kind: 'wisdom', key: 'THINK', title: 'Buddhi', text: 'Discern, analyse and make wise choices.' },
  { kind: 'wisdom', key: 'FEEL', title: 'Bhava', text: 'Understand and regulate emotions.' },
  { kind: 'wisdom', key: 'CONNECT', title: 'Sambandh', text: 'Build meaningful relationships and understand others.' },
  { kind: 'wisdom', key: 'LEAD', title: 'Karma', text: 'Translate understanding into responsible action.' },
  { kind: 'leadership_style', key: 'THOUGHTFUL_INITIATOR', title: 'The Thoughtful Initiator', text: 'You tend to understand a challenge, identify a direction and move towards action. Your next level of leadership comes from creating space for different perspectives and emotions while continuing to move the group forward.' },
  { kind: 'snapshot_reflection', key: 'PERSPECTIVE_TAKING', text: 'How might this decision affect different people?' },
  { kind: 'mantra', text: 'Think wisely. Feel deeply. Connect meaningfully. Act responsibly.' },
  { kind: 'disclaimer', position: 1, text: 'The India Mind League Future Readiness Report is a developmental assessment based on performance and observed responses during IML activities. It is not an IQ test, psychological diagnosis, personality diagnosis or clinical assessment.' },
  { kind: 'disclaimer', position: 2, text: 'Student performance may be influenced by familiarity, experience, attention, context and participation during the assessment. The report should therefore be viewed as a snapshot for reflection and development rather than a permanent label of ability.' },
];

export async function seedContentLibrary(prisma: PrismaClient) {
  const existing = await prisma.scorecardLibrary.findFirst({ where: { name: SAMPLE_LIBRARY_NAME } });
  if (existing) return { created: false, code: existing.code };

  let max = 0;
  for (const l of await prisma.scorecardLibrary.findMany({ select: { code: true } })) {
    const m = l.code.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const code = `CL${max + 1}`;
  const lib = await prisma.scorecardLibrary.create({
    data: {
      code,
      name: SAMPLE_LIBRARY_NAME,
      defaultLanguage: 'en',
      languages: ['en'],
      notes:
        'Loaded from the client’s sample report as drafts. Wording the sample shows for one level only sits at that level; the rest still has to be written. Nothing is approved - review it, fill the gaps (see Coverage) and approve.',
    },
  });
  await prisma.scorecardText.createMany({
    data: rows.map((r) => ({
      libraryId: lib.id,
      kind: r.kind,
      key: r.key ?? '',
      levelKey: r.levelKey ?? '',
      language: 'en',
      position: r.position ?? 0,
      title: r.title ?? null,
      draftText: r.text,
      updatedByName: 'Sample report import',
    })),
  });
  return { created: true, code, texts: rows.length };
}

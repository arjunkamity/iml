import type { PrismaClient } from '@prisma/client';
import type { AssessmentConfig } from '../common/assessment-scoring';

// "Mind Capacity Check" — content taken word for word from the client's
// IML-Free-Assessment.html (16 scenarios, 4 per capacity, options ordered
// least to most developed = 1..4 points). Seeded once as a published
// assessment; from Phase 2a it is managed in the admin like any other.

export const MIND_CAPACITY_CHECK = {
  code: 'AS1',
  slug: 'mind-capacity-check',
  title: 'Mind Capacity Check',
  summary:
    'Your next step starts with knowing yourself. Explore everyday school situations and discover behaviours you can practise to become more future-ready.',
  // An explicit list, not a range: gradeMatches() reads '9-12' as grade 9 or 12.
  grades: '9,10,11,12',
} as const;

const BAND_SUMMARIES = [
  'Start by noticing the situation and considering its impact.',
  'You show some awareness; practise turning it into consistent action.',
  'Your choices show thoughtful responses across several situations.',
  'Your choices combine awareness, responsible action and follow-through.',
];

function bands() {
  return [
    { label: 'Emerging', min: 4, max: 7, summary: BAND_SUMMARIES[0] },
    { label: 'Developing', min: 8, max: 10, summary: BAND_SUMMARIES[1] },
    { label: 'Proficient', min: 11, max: 13, summary: BAND_SUMMARIES[2] },
    { label: 'Advanced', min: 14, max: 16, summary: BAND_SUMMARIES[3] },
  ];
}

export const MIND_CAPACITY_CHECK_CONFIG: AssessmentConfig = {
  dimensions: [
    {
      key: 'THINK',
      label: 'THINK',
      intro: 'Explore evidence, question assumptions and solve problems.',
      practice: 'Before sharing a claim, check its source, evidence and what might be missing.',
      bands: bands(),
    },
    {
      key: 'FEEL',
      label: 'FEEL',
      intro: 'Notice emotions and respond with empathy and self-awareness.',
      practice: 'When an emotion rises, pause, name it and choose one respectful response.',
      bands: bands(),
    },
    {
      key: 'CONNECT',
      label: 'CONNECT',
      intro: 'Include others, build trust and act with shared values.',
      practice: 'Invite someone’s perspective before deciding what support or inclusion looks like.',
      bands: bands(),
    },
    {
      key: 'LEAD',
      label: 'LEAD',
      intro: 'Take responsibility and turn intentions into thoughtful action.',
      practice: 'Choose a small goal, agree on responsibilities and review the result.',
      bands: bands(),
    },
  ],
  // DRAFT — consent wording for saving results of minors is awaiting client
  // approval (epic #24, task #29). Edit here (or in the Assessment's config)
  // without a code change.
  consent:
    'Your answers and result are saved to your India Mind League account. IML administrators can see them to understand how students use this reflection. They are not marks, are not used for ranking or admission, and you can retake the check at any time.',
  disclaimer:
    'This is an educational reflection tool, not a validated psychological test or a measure of fixed intelligence. Results describe choices in these scenarios; they should not be used for diagnosis, admission or ranking. A scenario check cannot capture all your abilities. Discuss your reflection with a teacher or counsellor and use real-life observations alongside it.',
  howScored:
    'Each capacity has four scenarios. Responses receive 1–4 points for increasing awareness, judgement and responsible follow-through. Capacity totals range from 4–16: Emerging 4–7; Developing 8–10; Proficient 11–13; Advanced 14–16. These provisional EDPA bands are learning guides, not population norms or expert-validated cut-offs. There is no overall intelligence score.',
};

// [dimension index into THINK/FEEL/CONNECT/LEAD, scenario, options (1..4 points)]
const DIMS = ['THINK', 'FEEL', 'CONNECT', 'LEAD'] as const;
const ITEMS: [number, string, [string, string, string, string]][] = [
  [0, 'A message in your class group claims that tomorrow’s exam has been cancelled. What do you do first?', ['Forward it so nobody misses the news.', 'Ask one friend whether it sounds true.', 'Check the school’s official notice before acting.', 'Verify the official notice and source, then share the confirmed information.']],
  [1, 'You receive a lower score than expected and feel upset. What is your first response?', ['Decide that you are simply bad at the subject.', 'Hide your feelings and avoid looking at the paper.', 'Take a pause, name your feelings and review the feedback when calmer.', 'Pause, recognise your feelings, then use feedback to plan one realistic improvement.']],
  [2, 'A new student is regularly left out of lunch conversations. How do you respond?', ['Assume they prefer to be alone.', 'Say hello when you happen to meet.', 'Invite them to join and ask what they enjoy.', 'Invite them without pressure, listen to their preferences and help the group include them.']],
  [3, 'Your team has one week to reduce food waste at school. What do you suggest?', ['Make a poster and consider the task complete.', 'Ask everyone to waste less food.', 'Set a goal and divide responsibilities for a small trial.', 'Measure current waste, agree on a realistic trial, assign roles and review its impact.']],
  [0, 'An AI tool gives you a convincing answer for an assignment. What do you do?', ['Submit it without checking.', 'Change a few words and submit it.', 'Check key facts and write the answer in your own words.', 'Verify facts using reliable sources, develop your own reasoning and disclose AI use as required.']],
  [1, 'A teammate snaps at you just before a presentation. How do you respond?', ['Snap back in front of everyone.', 'Stop speaking to them for the rest of the day.', 'Stay calm and ask privately whether something is wrong.', 'Regulate your reaction, check in privately and explain respectfully how their words affected you.']],
  [2, 'Your group proposes an event activity that a student with limited mobility cannot join. What do you do?', ['Keep the plan because most students can participate.', 'Offer the student a separate task without asking them.', 'Ask the student what support would help them participate.', 'Consult them respectfully and work with the group to redesign the activity for meaningful participation.']],
  [3, 'Two team members disagree, and the project is falling behind. How do you help?', ['Let them argue until one gives in.', 'Choose the idea of the louder member.', 'Hear both views and agree on the next task.', 'Hear both views, compare options against the goal and agree on roles and a review point.']],
  [0, 'Your school survey has 20 replies, mostly from your close friends. Can you claim it represents the whole school?', ['Yes, because all respondents are students.', 'Yes, if most answers agree.', 'No; the sample is small and may be biased.', 'No; explain the limits and gather a broader, more representative sample before making that claim.']],
  [1, 'A friend says they are overwhelmed by examination pressure. What do you do?', ['Tell them everyone has problems.', 'Tell them to stop worrying and study harder.', 'Listen without judgement and ask what support would help.', 'Listen, ask what support they want and encourage help from a trusted adult if the pressure is persistent or serious.']],
  [2, 'Someone shares a humiliating meme of a classmate in a group chat. How do you respond?', ['React with a laughing emoji.', 'Ignore it because you did not create it.', 'Avoid sharing it and privately support the classmate.', 'Avoid amplifying it, support the classmate and use a trusted adult or school reporting route to seek help.']],
  [3, 'You notice students leaving litter in a shared corridor. What is your approach?', ['Leave it for the cleaning staff.', 'Complain to your friends.', 'Use the bins yourself and remind others politely.', 'Model responsible behaviour, identify why litter builds up and work with others on a practical solution.']],
  [0, 'Two credible sources give different explanations of the same issue. How do you decide?', ['Choose the one that agrees with you.', 'Choose the one with more followers.', 'Compare their evidence and publication context.', 'Compare evidence, dates and methods, and acknowledge uncertainty where it remains.']],
  [1, 'You realise your joke hurt a classmate. What do you do?', ['Say they are too sensitive.', 'Avoid them until they forget.', 'Apologise and listen to how they felt.', 'Acknowledge the impact, apologise without excuses, listen and change the behaviour.']],
  [2, 'Your close friend asks you to cover up their cheating. What do you do?', ['Agree because loyalty comes first.', 'Refuse but spread the story to classmates.', 'Refuse and encourage them to take responsibility.', 'Refuse respectfully, encourage accountability and follow the school’s process without public shaming.']],
  [3, 'Your team’s plan fails during a school activity. What do you do next?', ['Blame whoever made the mistake.', 'Wait for someone else to fix it.', 'Accept your part and help organise a workable alternative.', 'Accept responsibility, coordinate a safe alternative and later review lessons with the team.']],
];

export const MIND_CAPACITY_CHECK_ITEM_COUNT = ITEMS.length;

/**
 * Idempotent: safe to run on every deploy or by hand. Creates the capacity
 * categories, the assessment (Published) and its 16 questions if missing.
 * Never flips an existing assessment's status, and never rewrites question
 * text once the assessment has submissions (stored results must keep the
 * meaning they were scored against).
 */
const CATEGORY = 'Personality & Self-awareness';

export async function seedMindCapacityCheck(prisma: PrismaClient) {
  const existingCategories = await prisma.questionCategory.findMany({ select: { name: true, position: true } });
  let position = Math.max(0, ...existingCategories.map((c) => c.position));
  for (const key of DIMS) {
    if (!existingCategories.some((c) => c.name === key)) {
      await prisma.questionCategory.create({ data: { name: key, active: true, position: ++position } });
    }
  }

  // Setting-up only. Once the assessment exists it belongs to the admins
  // (Admin > Assessments): this never rewrites its title, grades, scoring or
  // existing questions, so re-running it can neither undo an admin's edit nor
  // change what saved results mean. It only fills in what is missing.
  const category =
    (await prisma.assessmentCategory.findUnique({ where: { name: CATEGORY } })) ??
    (await prisma.assessmentCategory.create({ data: { name: CATEGORY } }));

  const existing = await prisma.assessment.findUnique({ where: { code: MIND_CAPACITY_CHECK.code } });
  const assessment = existing
    ? await prisma.assessment.update({
        where: { id: existing.id },
        data: {
          ...(existing.categoryId == null ? { categoryId: category.id } : {}),
          ...(existing.status === 'Published' && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        },
      })
    : await prisma.assessment.create({
        data: {
          code: MIND_CAPACITY_CHECK.code,
          status: 'Published',
          publishedAt: new Date(),
          categoryId: category.id,
          slug: MIND_CAPACITY_CHECK.slug,
          title: MIND_CAPACITY_CHECK.title,
          summary: MIND_CAPACITY_CHECK.summary,
          grades: MIND_CAPACITY_CHECK.grades,
          config: MIND_CAPACITY_CHECK_CONFIG as unknown as object,
        },
      });

  let created = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const [dim, prompt, options] = ITEMS[i];
    const code = `MCC${String(i + 1).padStart(2, '0')}`;
    if (await prisma.question.findUnique({ where: { code }, select: { id: true } })) continue;
    await prisma.question.create({
      data: {
        code,
        assessmentId: assessment.id,
        grade: 'All',
        category: DIMS[dim],
        qtype: 'text',
        mode: 'single',
        prompt,
        options,
        optionPoints: [1, 2, 3, 4],
        correct: [],
      },
    });
    created++;
  }
  return { assessmentId: assessment.id, createdAssessment: !existing, questionsCreated: created };
}

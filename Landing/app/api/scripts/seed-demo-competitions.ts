/**
 * One-off, PURELY ADDITIVE demo-data seed — unlike prisma/seed.ts, this
 * NEVER deletes anything. Creates 3 clearly-marked "[DEMO] ..." Draft
 * competitions (never visible on the public site) with stages, demo
 * students/registrations, and crafted attempt data, so an admin can give
 * a live product demo without touching any real school/student data.
 *
 * Competition A ("Regional Aptitude Challenge") is deliberately crafted so
 * Stage 1's Next Stage Selection wizard has real, multi-criteria ties to
 * walk through live: 3 clear winners by speed, then a tied group that
 * needs fewest-answer-changes to partly resolve, then avg-time-per-
 * question to resolve further, ending in one genuine 2-way manual pick.
 *
 * Competition B ("Leadership Excellence Cup") already has its Stage 1
 * selection committed and a couple of Stage 2 attempts scored, to show
 * off Results / Payment History / a completed multi-stage journey.
 *
 * Competition C ("Innovators Championship") is just freshly registered
 * students, no attempts yet — an early-stage example for Registrations.
 *
 * Safe to re-run: bails out if any "D-" competition code already exists.
 *
 * Run with:  npx ts-node scripts/seed-demo-competitions.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const FIRST_NAMES = ['Aarav', 'Ishaan', 'Vihaan', 'Aryan', 'Reyansh', 'Ananya', 'Diya', 'Myra', 'Saanvi', 'Kiara', 'Rohan', 'Neha', 'Kabir', 'Zara', 'Advait', 'Riya', 'Arjun', 'Tara', 'Dev', 'Sana'];
const LAST_NAMES = ['Sharma', 'Verma', 'Iyer', 'Rao', 'Gupta', 'Nair', 'Kapoor', 'Menon', 'Bose', 'Malhotra', 'Chatterjee', 'Reddy', 'Joshi', 'Pillai', 'Khanna'];

function demoStudentName(i: number): string {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
}

// Ten generic, real GK/IQ-style questions reused (with fresh codes) across
// every demo stage that needs a question pool — content doesn't matter for
// a demo, correctness/timing is what's being shown off.
const QUESTION_BANK: { prompt: string; options: string[]; correct: number[] }[] = [
  { prompt: 'Which number completes the series? 3, 6, 12, 24, ___', options: ['36', '42', '48', '54'], correct: [2] },
  { prompt: 'If MONDAY is coded as NPOEBZ, how is TUESDAY coded?', options: ['UVFTBEZ', 'UVFTCEZ', 'UVFSCEZ', 'UVFTCEY'], correct: [1] },
  { prompt: 'Which word does NOT belong with the others?', options: ['Trumpet', 'Violin', 'Flute', 'Painting'], correct: [3] },
  { prompt: 'A team member missed a deadline. The most constructive first response is to…', options: ['Publicly call it out', 'Ask what happened and how to help', 'Reassign all their work', 'Ignore it'], correct: [1] },
  { prompt: 'Which of these is a renewable energy source?', options: ['Coal', 'Natural gas', 'Solar', 'Petroleum'], correct: [2] },
  { prompt: 'What is the next prime number after 29?', options: ['30', '31', '33', '37'], correct: [1] },
  { prompt: 'You disagree with a group decision. The most collaborative approach is to…', options: ['Go along silently and resent it', 'Voice your view respectfully with reasons', 'Refuse to participate', 'Complain to others later'], correct: [1] },
  { prompt: 'Which continent is the Sahara Desert located on?', options: ['Asia', 'Africa', 'Australia', 'South America'], correct: [1] },
  { prompt: 'If a train travels 60 km in 45 minutes, its speed in km/h is…', options: ['70', '75', '80', '85'], correct: [2] },
  { prompt: 'A good leader facing a mistake by their own team should…', options: ['Blame an individual publicly', 'Own it, then fix and learn together', 'Hide it from stakeholders', 'Wait for it to blow over'], correct: [1] },
];

async function ensureQuestions(competitionId: number, codePrefix: string) {
  const created: { id: number; correct: number[] }[] = [];
  for (let i = 0; i < QUESTION_BANK.length; i++) {
    const q = QUESTION_BANK[i];
    const code = `${codePrefix}${i + 1}`;
    const row = await prisma.question.create({
      data: {
        code,
        competitionId,
        grade: '9-12',
        category: i % 3 === 0 ? 'EQ' : i % 3 === 1 ? 'Values' : 'IQ',
        qtype: 'text',
        mode: 'single',
        label: null,
        ref: code,
        prompt: q.prompt,
        options: q.options as unknown as Prisma.InputJsonValue,
        correct: q.correct as unknown as Prisma.InputJsonValue,
      },
    });
    created.push({ id: row.id, correct: q.correct });
  }
  return created;
}

/** Builds one finished Attempt + its AttemptAnswer rows for a student at
 * a stage, deterministically hitting an exact score/duration/changes/avg
 * by construction rather than randomly — every knob here is intentional. */
async function makeAttempt(opts: {
  registrationId: number;
  stageId: number;
  questions: { id: number; correct: number[] }[];
  code: string;
  correctCount: number; // how many of the questions this attempt gets right
  durationSecs: number; // Attempt.clientElapsedSecs — the primary ranking criterion
  avgTakenSecs: number; // every question gets exactly this takenSecs, so the average is exact
  changesOnFirstQuestion: number; // all "answer changes" concentrated on question 1, so totalChanges is exact
  startedAt: Date;
}) {
  const { registrationId, stageId, questions, code, correctCount, durationSecs, avgTakenSecs, changesOnFirstQuestion, startedAt } = opts;
  const finishedAt = new Date(startedAt.getTime() + durationSecs * 1000);
  const total = questions.length;
  const score = correctCount;

  const attempt = await prisma.attempt.create({
    data: {
      code,
      registrationId,
      stageId,
      startedAt,
      finishedAt,
      score,
      total,
      clientElapsedSecs: durationSecs,
      questionIds: questions.map((q) => q.id) as unknown as Prisma.InputJsonValue,
    },
  });

  const rows: Prisma.AttemptAnswerUncheckedCreateInput[] = questions.map((q, i) => {
    const isCorrect = i < correctCount;
    const given = isCorrect ? q.correct[0] : (q.correct[0] + 1) % 4; // any wrong option
    return {
      attemptId: attempt.id,
      questionId: q.id,
      answer: [given],
      isCorrect,
      takenSecs: Math.round(avgTakenSecs),
      changeCount: i === 0 ? changesOnFirstQuestion : 0,
      timeUp: false,
      answeredAt: finishedAt,
    };
  });
  await prisma.attemptAnswer.createMany({ data: rows });
  return attempt;
}

async function createStudentAndRegistration(name: string, grade: string, competitionId: number, code: string) {
  const student = await prisma.student.create({
    data: {
      code,
      name,
      grade,
      email: `${code.toLowerCase()}@demo.indiamindleague.com`,
    },
  });
  const registration = await prisma.registration.create({
    data: {
      code,
      studentId: student.id,
      competitionId,
      status: 'Registered',
      registeredAt: new Date(),
    },
  });
  return { student, registration };
}

async function main() {
  const existing = await prisma.competition.findFirst({ where: { code: { startsWith: 'D' }, title: { startsWith: '[DEMO]' } } });
  if (existing) {
    console.log(`Demo data already exists (found "${existing.code} — ${existing.title}"). Nothing to do — delete it first if you want a fresh set.`);
    return;
  }

  // =========================================================================
  // Competition A — Regional Aptitude Challenge: LIVE selection-wizard demo.
  // Stage 1 has maxQualifiers=5 and is left UNCOMMITTED on purpose.
  // =========================================================================
  const compA = await prisma.competition.create({
    data: {
      code: 'D1',
      title: '[DEMO] Regional Aptitude Challenge 2026',
      grades: '9-12',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      status: 'Draft',
      isMulti: true,
      description: 'Demo competition — safe to delete. Stage 1 is ready for a live Next Stage Selection walkthrough.',
    },
  });
  const stageA1 = await prisma.competitionStage.create({
    data: {
      competitionId: compA.id,
      position: 1,
      name: 'Stage 1 — Online Assessment',
      mode: 'Online',
      passMark: 40,
      maxQualifiers: 5,
      isFree: false,
      price: 300,
      description: 'General aptitude assessment. Top 5 advance to the Regional Finals.',
    },
  });
  await prisma.competitionStage.create({
    data: {
      competitionId: compA.id,
      position: 2,
      name: 'Stage 2 — Regional Finals',
      mode: 'Online',
      passMark: 50,
      isFree: false,
      price: 400,
      description: 'Advanced round for Stage 1 qualifiers.',
    },
  });
  const qA = await ensureQuestions(compA.id, 'DQA');

  const baseStart = new Date('2026-08-10T09:00:00Z');
  let regCounter = 1000;

  // 3 clear winners — fast and unique durations, no ties at all.
  const clearWinners = [
    { correctCount: 9, durationSecs: 150, avgTakenSecs: 8.0, changes: 0 },
    { correctCount: 9, durationSecs: 170, avgTakenSecs: 8.5, changes: 0 },
    { correctCount: 8, durationSecs: 160, avgTakenSecs: 9.0, changes: 1 },
  ];
  // 6 students tied at EXACTLY the same duration (300s) — all clear the
  // pass mark, none distinguishable on speed alone. totalChanges then
  // separates 1 of them; the remaining 3 tie on totalChanges too, and
  // avgTakenSecs only separates 1 more, leaving a genuine 2-way tie for
  // the very last seat.
  const tiedGroup = [
    { correctCount: 6, changes: 0, avgTakenSecs: 10.0 }, // clears on criteria 2 alone (uniquely fewest changes)
    { correctCount: 6, changes: 1, avgTakenSecs: 11.0 }, // still tied after criteria 3 — needs a human
    { correctCount: 6, changes: 1, avgTakenSecs: 11.0 }, // still tied after criteria 3 — needs a human (same avg as above)
    { correctCount: 6, changes: 1, avgTakenSecs: 12.5 }, // eliminated at criteria 3 (slower average than the tied pair)
    { correctCount: 6, changes: 2, avgTakenSecs: 14.0 }, // eliminated at criteria 2
    { correctCount: 7, changes: 2, avgTakenSecs: 15.0 }, // eliminated at criteria 2
  ];
  // 3 students below the pass mark — the "ineligible" bucket.
  const belowPassMark = [
    { correctCount: 3, durationSecs: 280, avgTakenSecs: 20.0, changes: 0 },
    { correctCount: 2, durationSecs: 260, avgTakenSecs: 18.0, changes: 1 },
    { correctCount: 3, durationSecs: 310, avgTakenSecs: 22.0, changes: 0 },
  ];

  let studentIdx = 0;
  for (const w of clearWinners) {
    regCounter++;
    const code = `DR${regCounter}`;
    const { registration } = await createStudentAndRegistration(demoStudentName(studentIdx++), String(9 + (studentIdx % 4)), compA.id, code);
    await makeAttempt({
      registrationId: registration.id,
      stageId: stageA1.id,
      questions: qA,
      code: `DT${regCounter}`,
      correctCount: w.correctCount,
      durationSecs: w.durationSecs,
      avgTakenSecs: w.avgTakenSecs,
      changesOnFirstQuestion: w.changes,
      startedAt: baseStart,
    });
    await prisma.registrationStage.create({
      data: { registrationId: registration.id, stageId: stageA1.id, status: 'Attempted', score: (w.correctCount / 10) * 100, qualified: true },
    });
    await prisma.registration.update({ where: { id: registration.id }, data: { status: 'Test Taken' } });
  }
  for (const t of tiedGroup) {
    regCounter++;
    const code = `DR${regCounter}`;
    const { registration } = await createStudentAndRegistration(demoStudentName(studentIdx++), String(9 + (studentIdx % 4)), compA.id, code);
    await makeAttempt({
      registrationId: registration.id,
      stageId: stageA1.id,
      questions: qA,
      code: `DT${regCounter}`,
      correctCount: t.correctCount,
      durationSecs: 300,
      avgTakenSecs: t.avgTakenSecs,
      changesOnFirstQuestion: t.changes,
      startedAt: baseStart,
    });
    await prisma.registrationStage.create({
      data: { registrationId: registration.id, stageId: stageA1.id, status: 'Attempted', score: (t.correctCount / 10) * 100, qualified: t.correctCount >= 4 },
    });
    await prisma.registration.update({ where: { id: registration.id }, data: { status: 'Test Taken' } });
  }
  for (const b of belowPassMark) {
    regCounter++;
    const code = `DR${regCounter}`;
    const { registration } = await createStudentAndRegistration(demoStudentName(studentIdx++), String(9 + (studentIdx % 4)), compA.id, code);
    await makeAttempt({
      registrationId: registration.id,
      stageId: stageA1.id,
      questions: qA,
      code: `DT${regCounter}`,
      correctCount: b.correctCount,
      durationSecs: b.durationSecs,
      avgTakenSecs: b.avgTakenSecs,
      changesOnFirstQuestion: b.changes,
      startedAt: baseStart,
    });
    await prisma.registrationStage.create({
      data: { registrationId: registration.id, stageId: stageA1.id, status: 'Attempted', score: (b.correctCount / 10) * 100, qualified: false },
    });
    await prisma.registration.update({ where: { id: registration.id }, data: { status: 'Test Taken' } });
  }
  console.log(`Competition A (${compA.code}) ready — ${clearWinners.length + tiedGroup.length + belowPassMark.length} attempts at Stage 1, selection NOT yet run.`);

  // =========================================================================
  // Competition B — Leadership Excellence Cup: a completed example, with
  // Payment History + a multi-stage journey to show off Results.
  // =========================================================================
  const compB = await prisma.competition.create({
    data: {
      code: 'D2',
      title: '[DEMO] Leadership Excellence Cup 2026',
      grades: '9-12',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      status: 'Draft',
      isMulti: true,
      description: 'Demo competition — safe to delete. Shows a completed Stage 1 selection and a Stage 2 in progress.',
    },
  });
  const stageB1 = await prisma.competitionStage.create({
    data: { competitionId: compB.id, position: 1, name: 'Stage 1 — Online Quiz', mode: 'Online', passMark: 40, maxQualifiers: 5, isFree: false, price: 250, description: 'Opening online round.' },
  });
  const stageB2 = await prisma.competitionStage.create({
    data: { competitionId: compB.id, position: 2, name: 'Stage 2 — Live Zoom Showdown', mode: 'Hybrid', passMark: 50, isFree: false, price: 350, description: 'Live round for Stage 1 qualifiers.' },
  });
  await prisma.competitionStage.create({
    data: { competitionId: compB.id, position: 3, name: 'Stage 3 — Leadership Bootcamp', mode: 'Peer Interview', passMark: 60, isFree: false, price: 500, description: 'Final panel round.' },
  });
  const qB = await ensureQuestions(compB.id, 'DQB');

  const stage1Scores = [90, 85, 80, 75, 70, 60, 55, 45, 30, 20]; // 10 students, top 5 qualify
  const paymentModes = ['UPI', 'Card', 'Net Banking', 'UPI', 'Card'];
  const paymentStatuses = ['Paid', 'Paid', 'Paid', 'Pending', 'Failed'];
  const stage1Regs: { registrationId: number; correct: number }[] = [];

  for (let i = 0; i < stage1Scores.length; i++) {
    regCounter++;
    const code = `DR${regCounter}`;
    const { registration } = await createStudentAndRegistration(demoStudentName(studentIdx++), String(9 + (studentIdx % 4)), compB.id, code);
    const correctCount = Math.round(stage1Scores[i] / 10);
    await makeAttempt({
      registrationId: registration.id,
      stageId: stageB1.id,
      questions: qB,
      code: `DT${regCounter}`,
      correctCount,
      durationSecs: 200 + i * 15,
      avgTakenSecs: 10 + i,
      changesOnFirstQuestion: i % 2,
      startedAt: new Date('2026-07-10T09:00:00Z'),
    });
    const qualified = i < 5;
    await prisma.registrationStage.create({
      data: { registrationId: registration.id, stageId: stageB1.id, status: qualified ? 'Qualified' : 'Eliminated', score: stage1Scores[i], qualified },
    });
    await prisma.registration.update({ where: { id: registration.id }, data: { status: qualified ? 'Qualified' : 'Test Taken' } });
    if (qualified) {
      await prisma.registrationStage.create({
        data: { registrationId: registration.id, stageId: stageB2.id, status: 'Unlocked', unlockedAt: new Date('2026-07-11T09:00:00Z') },
      });
    }
    stage1Regs.push({ registrationId: registration.id, correct: correctCount });
    if (i < 5) {
      await prisma.payment.create({
        data: {
          code: `DPAY-${regCounter}`,
          registrationId: registration.id,
          stageId: stageB1.id,
          amount: 250,
          mode: paymentModes[i],
          status: paymentStatuses[i],
          providerTxn: paymentStatuses[i] === 'Paid' ? `DEMO-TXN-${regCounter}` : null,
          paidAt: paymentStatuses[i] === 'Paid' ? new Date('2026-07-09T12:00:00Z') : null,
        },
      });
    }
  }

  // 3 of the 5 Stage-1 qualifiers have also completed Stage 2.
  const stage2Outcomes = [72, 65, 45]; // 2 pass (>=50), 1 fails
  for (let i = 0; i < stage2Outcomes.length; i++) {
    const reg = stage1Regs[i];
    const correctCount = Math.round(stage2Outcomes[i] / 10);
    regCounter++;
    await makeAttempt({
      registrationId: reg.registrationId,
      stageId: stageB2.id,
      questions: qB,
      code: `DT${regCounter}`,
      correctCount,
      durationSecs: 240 + i * 10,
      avgTakenSecs: 13 + i,
      changesOnFirstQuestion: 0,
      startedAt: new Date('2026-07-20T09:00:00Z'),
    });
    const qualified = stage2Outcomes[i] >= 50;
    await prisma.registrationStage.updateMany({
      where: { registrationId: reg.registrationId, stageId: stageB2.id },
      data: { status: qualified ? 'Qualified' : 'Eliminated', score: stage2Outcomes[i], qualified },
    });
    await prisma.registration.update({ where: { id: reg.registrationId }, data: { status: qualified ? 'Qualified' : 'Test Taken' } });
  }
  console.log(`Competition B (${compB.code}) ready — Stage 1 selection committed (5 qualified of 10), Stage 2 has 3 attempts.`);

  // =========================================================================
  // Competition C — Innovators Championship: fresh registrations only.
  // =========================================================================
  const compC = await prisma.competition.create({
    data: {
      code: 'D3',
      title: '[DEMO] Innovators Championship 2026',
      grades: '9-12',
      startDate: new Date('2026-09-15'),
      endDate: new Date('2026-10-15'),
      status: 'Draft',
      isMulti: false,
      description: 'Demo competition — safe to delete. Freshly registered students, no attempts yet.',
    },
  });
  await prisma.competitionStage.create({
    data: { competitionId: compC.id, position: 1, name: 'Online Assessment', mode: 'Online', passMark: 40, isFree: true, price: 0, description: 'Free entry-level round.' },
  });
  for (let i = 0; i < 8; i++) {
    regCounter++;
    const code = `DR${regCounter}`;
    await createStudentAndRegistration(demoStudentName(studentIdx++), String(9 + (studentIdx % 4)), compC.id, code);
  }
  console.log(`Competition C (${compC.code}) ready — 8 fresh registrations, no attempts.`);

  console.log('\nDone. All 3 demo competitions are Draft (admin-only, not on the public site) and titled "[DEMO] ...".');
  console.log('To remove them later: delete competitions D1, D2, D3 from Admin > Competitions (cascades stages/attempts/payments), then delete the DR-coded demo students from Admin > Registrations.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

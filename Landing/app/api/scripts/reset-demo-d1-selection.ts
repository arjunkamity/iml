/** One-off: resets Competition D1's Stage 1 selection back to its
 * freshly-seeded, uncommitted state — every attempt sits as 'Attempted'
 * (RegistrationStage.qualified left as originally computed, status reset
 * to 'Attempted'), Registration.status back to 'Test Taken', and any
 * Stage 2 RegistrationStage rows created by a prior commit are removed.
 * Safe to re-run after every demo walkthrough. Touches only D1's own
 * registrations — nothing else. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const comp = await prisma.competition.findUnique({ where: { code: 'D1' } });
  if (!comp) throw new Error('Competition D1 not found');
  const stages = await prisma.competitionStage.findMany({ where: { competitionId: comp.id }, orderBy: { position: 'asc' } });
  const stage1 = stages[0];
  const stage2 = stages[1];
  if (!stage1 || !stage2) throw new Error('Expected 2 stages on D1');

  const stage1Rows = await prisma.registrationStage.findMany({ where: { stageId: stage1.id } });
  console.log(`Found ${stage1Rows.length} Stage 1 RegistrationStage rows.`);

  for (const rs of stage1Rows) {
    // qualified (pass/fail the mark) is recomputed from the attempt's own
    // score, same as when it was first seeded — status always resets to
    // 'Attempted' regardless of a prior commit's Qualified/Eliminated.
    const attempt = await prisma.attempt.findFirst({ where: { registrationId: rs.registrationId, stageId: stage1.id } });
    const percent = attempt && Number(attempt.total) > 0 ? Math.round((Number(attempt.score) / Number(attempt.total)) * 100) : 0;
    const qualified = percent >= Number(stage1.passMark);
    await prisma.registrationStage.update({
      where: { registrationId_stageId: { registrationId: rs.registrationId, stageId: stage1.id } },
      data: { status: 'Attempted', score: percent, qualified },
    });
    await prisma.registration.update({ where: { id: rs.registrationId }, data: { status: 'Test Taken' } });
  }

  const removedNext = await prisma.registrationStage.deleteMany({ where: { stageId: stage2.id } });
  console.log(`Removed ${removedNext.count} Stage 2 row(s) created by a prior commit.`);

  console.log('D1 Stage 1 selection reset — ready to re-run the wizard from scratch.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * One-off: pushes the new STAGE1_SUBMITTED content to the EXISTING
 * MessageTemplate row. seed-templates.ts deliberately never overwrites an
 * existing row's body (only its label) so a prior admin edit is never
 * silently clobbered — this script is the explicit, one-time exception
 * for this specific content change (client requirement, 2026-09-03: the
 * completion email must not reveal score/qualify status).
 *
 * Safe to re-run — it's just a plain update to one row by key.
 *
 * Run with:  npx ts-node scripts/update-stage1-submitted-template.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function p(text: string): string {
  return `<p>${text}</p>`;
}

async function main() {
  const smsBody = 'Thank you for completing the India Mind League - Assessment. Your result will be updated on your dashboard.';
  const emailSubject = 'Thank You for Completing the India Mind League Assessment';
  const emailBody = [
    p('Dear {StudentName},'),
    p('Thank you for completing the India Mind League – Assessment.'),
    p('Your result will be updated on your dashboard.'),
    p('You can also download your Participation Certificate from the dashboard.'),
    p('Warm regards,<br/>Team India Mind League'),
  ].join('');

  const updated = await prisma.messageTemplate.update({
    where: { key: 'STAGE1_SUBMITTED' },
    data: { smsBody, emailSubject, emailBody },
  });
  console.log(`Updated STAGE1_SUBMITTED (id ${updated.id}).`);
  console.log('New emailBody:', emailBody);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

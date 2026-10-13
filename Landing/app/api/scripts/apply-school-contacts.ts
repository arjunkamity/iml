/**
 * One-off: applies phone/email backfill for schools matched against the
 * NPSC master list (external source file), reading a plan JSON of
 * { code, name, phone, email } rows. Only ever fills fields that are
 * currently null — never overwrites an existing phone or email.
 *
 * Run with:  npx ts-node scripts/apply-school-contacts.ts plan.json
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PlanRow = { code: string; name: string; phone: string; email: string | null };

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx ts-node scripts/apply-school-contacts.ts <plan.json>');
    process.exit(1);
  }
  const plan: PlanRow[] = JSON.parse(require('fs').readFileSync(file, 'utf8'));

  let updated = 0;
  let skippedAlreadyHasPhone = 0;
  let skippedNotFound = 0;

  for (const row of plan) {
    const school = await prisma.school.findUnique({ where: { code: row.code } });
    if (!school) {
      console.log(`SKIP ${row.code}: not found in DB`);
      skippedNotFound++;
      continue;
    }
    if (school.phone) {
      console.log(`SKIP ${row.code} "${school.name}": already has a phone (${school.phone})`);
      skippedAlreadyHasPhone++;
      continue;
    }
    await prisma.school.update({
      where: { code: row.code },
      data: {
        phone: row.phone,
        email: school.email ?? (row.email ? row.email.toLowerCase() : null),
      },
    });
    console.log(`OK ${row.code} "${school.name}": phone -> ${row.phone}${row.email ? `, email -> ${row.email}` : ''}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${skippedAlreadyHasPhone} already had a phone, ${skippedNotFound} not found.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * One-time backfill: gives every existing school that has never had a
 * password (passwordHash IS NULL) a default one — its own registered
 * phone number — and marks it mustChangePassword so the forced
 * OTP-verify-then-set-password flow kicks in on its next login.
 *
 * Schools with no phone on file are left untouched (skipped, reported) —
 * there's nothing to default the password to; an admin needs to add one
 * from Admin > Schools first.
 *
 * Idempotent: only ever touches rows where passwordHash IS NULL, so
 * re-running after some schools have completed first-login is a no-op
 * for those.
 *
 * Run with:  npx ts-node scripts/backfill-school-passwords.ts
 */
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    where: { passwordHash: null },
    select: { id: true, code: true, name: true, phone: true },
  });

  let updated = 0;
  const skipped: string[] = [];

  for (const school of schools) {
    if (!school.phone) {
      skipped.push(`${school.code} — ${school.name} (no phone on file)`);
      continue;
    }
    const passwordHash = await argonHash(school.phone);
    await prisma.school.update({
      where: { id: school.id },
      data: { passwordHash, mustChangePassword: true },
    });
    updated++;
    console.log(`${school.code} — ${school.name}: default password set (phone: ${school.phone})`);
  }

  console.log(`\nDone. ${updated} school(s) updated, ${skipped.length} skipped.`);
  if (skipped.length) {
    console.log('\nSkipped (no phone on file):');
    for (const line of skipped) console.log(`  - ${line}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/** One-off: strips a trailing comma/whitespace some source emails had
 * (source spreadsheet quirk — a second address after the comma was
 * already dropped by apply-school-contacts.ts's cleanEmail, but a LONE
 * trailing comma with nothing after it slips past that same regex, since
 * ',' isn't excluded from the character class). Only ever trims trailing
 * punctuation off an existing value; never touches an email without one. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.school.findMany({
    where: { email: { not: null } },
    select: { id: true, code: true, name: true, email: true },
  });
  let fixed = 0;
  for (const s of rows) {
    const cleaned = (s.email ?? '').replace(/[,;\s]+$/, '');
    if (cleaned !== s.email) {
      await prisma.school.update({ where: { id: s.id }, data: { email: cleaned } });
      console.log(`${s.code} "${s.name}": "${s.email}" -> "${cleaned}"`);
      fixed++;
    }
  }
  console.log(`\nDone. ${fixed} email(s) cleaned.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

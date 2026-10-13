/** One-off: dumps every school's id/code/name/phone/email/passwordHash for
 * matching against an external source file. Not part of the app. */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: { id: true, code: true, name: true, city: true, phone: true, email: true, passwordHash: true },
    orderBy: { id: 'asc' },
  });
  fs.writeFileSync('db-schools.json', JSON.stringify(schools, null, 2));
  console.log(`Wrote ${schools.length} schools to db-schools.json`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

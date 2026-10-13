// One-off, idempotent: loads the client's sample report wording as a draft content
// library. Run after the content library migration is applied:
//   npm run build && npm run seed:scorecard-content
import { PrismaClient } from '@prisma/client';
import { seedContentLibrary } from './content-library.seed';

const prisma = new PrismaClient();

seedContentLibrary(prisma)
  .then((r) => console.log('Content library:', JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

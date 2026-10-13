// One-off, idempotent: creates the draft Future Readiness framework built from the
// client's sample report. Run after the scorecard migration is applied:
//   npm run build && npm run seed:scorecard
import { PrismaClient } from '@prisma/client';
import { seedFutureReadinessFramework } from './future-readiness.seed';

const prisma = new PrismaClient();

seedFutureReadinessFramework(prisma)
  .then((r) => console.log('Future Readiness framework:', JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// One-off, idempotent set-up for the first assessment (Mind Capacity Check).
// Run after the assessments migrations are applied:
//   npm run build && npm run seed:assessments
// Safe to re-run: once the assessment exists it only fills in what is missing
// and never rewrites what admins have edited (see seedMindCapacityCheck).
import { PrismaClient } from '@prisma/client';
import { seedMindCapacityCheck } from './mind-capacity-check.seed';

const prisma = new PrismaClient();

seedMindCapacityCheck(prisma)
  .then((r) => {
    console.log('Mind Capacity Check:', JSON.stringify(r));
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// One-off, idempotent: creates the draft Stage 1 report template from the client's sample.
// Run after the report migration is applied:
//   npm run build && npm run seed:scorecard-template
import { PrismaClient } from '@prisma/client';
import { seedFullReportTemplate, seedReportTemplate } from './report-template.seed';

const prisma = new PrismaClient();

seedReportTemplate(prisma)
  .then(async (r) => console.log('Report templates:', JSON.stringify([r, await seedFullReportTemplate(prisma)])))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

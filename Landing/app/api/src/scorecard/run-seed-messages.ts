// One-off, idempotent: adds the scorecard release message templates if they are missing.
//   npm run build && npm run seed:scorecard-messages
import { PrismaClient } from '@prisma/client';
import { seedScorecardMessageTemplates } from './message-templates.seed';

const prisma = new PrismaClient();

seedScorecardMessageTemplates(prisma)
  .then((r) => console.log('Scorecard message templates:', JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

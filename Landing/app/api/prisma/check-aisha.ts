import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const s = await prisma.student.findFirst({
    where: { email: 'aisha.khan@example.com' },
    include: { registrations: true, school: true },
  });
  console.log(JSON.stringify(s, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// One-off: seeds the Faq table with the exact 15 Q&As that were previously
// hardcoded into web/src/app/features/public/legal/faq.page.ts, so moving
// the FAQ page to admin-managed content doesn't blank out the live public
// page. Safe to re-run — skips if any Faq row already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'What is India Mind League?',
    answer:
      'India Mind League is a national Intellectual and Leadership Championship designed to develop IQ, EQ, SQ and Leadership Intelligence among school students.',
  },
  {
    question: 'Who can participate?',
    answer: 'Students studying in Classes IX–XII from recognized schools as notified for the current edition.',
  },
  {
    question: 'Can students register individually?',
    answer: 'Yes. Students may register individually or through their schools.',
  },
  {
    question: 'Is this only a quiz competition?',
    answer:
      'No. It includes critical thinking, leadership, communication, emotional intelligence, creativity, decision-making and real-world problem-solving.',
  },
  {
    question: 'Is the competition online or offline?',
    answer: 'Different stages may be conducted online, hybrid or offline depending on the competition format.',
  },
  {
    question: 'What skills are assessed?',
    answer:
      'Participants may be assessed on Intellectual Intelligence (IQ), Emotional Intelligence (EQ), Spiritual Intelligence (SQ), Leadership Intelligence (LQ), Creativity, Communication, Decision Making, Ethics, Innovation, Collaboration and General Awareness.',
  },
  {
    question: 'Will every participant receive a certificate?',
    answer: 'Yes. Eligible participants who complete the assessment successfully will receive a digital Certificate of Participation.',
  },
  {
    question: 'How are winners selected?',
    answer: 'Participants are evaluated through predefined scoring criteria across different stages by expert evaluators and the competition system.',
  },
  {
    question: 'Can parents accompany students?',
    answer: 'Parents may accompany students during designated offline events, subject to venue guidelines.',
  },
  {
    question: 'Is there a registration fee?',
    answer: 'Yes — ₹500 for the online qualifier, and ₹3,500 for students shortlisted to the Stage 3 Leadership Bootcamp.',
  },
  {
    question: 'Will scholarships be provided?',
    answer: 'Scholarships and special opportunities may be offered subject to partnerships, sponsorships and the policies applicable for each edition.',
  },
  {
    question: 'How will participants receive updates?',
    answer: 'Registered participants will receive updates through email, SMS, WhatsApp (where applicable) and the official IML website.',
  },
  {
    question: 'What happens in case of technical issues during the assessment?',
    answer:
      'Participants should immediately report the issue through the official support channels. Each case will be reviewed individually according to the competition guidelines.',
  },
  {
    question: 'How can schools become official partners?',
    answer: 'Schools may register as Institutional Partners by contacting the India Mind League Organising Committee through the official website.',
  },
  {
    question: 'Where can participants seek support?',
    answer: 'Participants may contact the India Mind League Help Desk through the official email, helpline number or website support portal during working hours.',
  },
];

function nextCode(codes: string[], prefix: string): string {
  let max = 0;
  for (const c of codes) {
    const m = c.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

async function main() {
  const existingCount = await prisma.faq.count();
  if (existingCount > 0) {
    console.log(`Faq table already has ${existingCount} row(s) — skipping seed (safe re-run guard).`);
    return;
  }
  const codes: string[] = [];
  for (let i = 0; i < FAQS.length; i++) {
    const code = nextCode(codes, 'FAQ');
    codes.push(code);
    await prisma.faq.create({
      data: { code, question: FAQS[i].question, answer: FAQS[i].answer, position: i, active: true },
    });
  }
  console.log(`Seeded ${FAQS.length} FAQs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

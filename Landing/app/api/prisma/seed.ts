/**
 * India Mind League — database seed.
 * Ports the current static demo data (admin/*.html + qualifiers.js) into Postgres.
 * Idempotent: wipes all tables, then re-inserts in FK order.
 *
 * Run with:  npx prisma db seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const DEV_ADMIN_PASSWORD = 'Admin@123';

type StageSeed = {
  name: string;
  mode: string;
  pass: number;
  price?: number;
  free?: boolean;
  desc?: string;
  rules?: string[];
};

const COMPETITIONS: Array<{
  id: string;
  title: string;
  grades: string;
  start: string;
  end: string;
  enrolled: number;
  status: string;
  multi: boolean;
  desc: string;
  stages: StageSeed[];
}> = [
  {
    id: 'C01',
    title: 'Digital Qualifier 2026',
    grades: '9-12',
    start: '2026-07-01',
    end: '2026-07-31',
    enrolled: 12,
    status: 'Live',
    multi: true,
    desc: "India Mind League's first digital qualifier — top scorers advance to the school zone rounds.",
    stages: [
      {
        name: 'Stage 1',
        mode: 'Online',
        pass: 40,
        price: 150,
        free: false,
        desc: 'General Knowledge & Logical Reasoning quiz.',
        rules: ['60 seconds per question', 'No negative marking'],
      },
      {
        name: 'Stage 2',
        mode: 'Online',
        pass: 50,
        price: 200,
        free: false,
        desc: 'Advanced aptitude + current affairs.',
        rules: ['One attempt only', 'Scores above 50% qualify to National Finals'],
      },
    ],
  },
  {
    id: 'C02',
    title: 'School Zone Challenge',
    grades: '9-10',
    start: '2026-08-01',
    end: '2026-08-15',
    enrolled: 8,
    status: 'Open',
    multi: true,
    desc: 'Inter-school challenge with three progressive stages from online quiz to face-to-face interview.',
    stages: [
      {
        name: 'Stage 1',
        mode: 'Online',
        pass: 40,
        price: 100,
        free: true,
        desc: 'GK + Maths sprint.',
        rules: ['Common timing for all', 'Use a stable internet connection'],
      },
      {
        name: 'Stage 2',
        mode: 'Hybrid',
        pass: 50,
        price: 150,
        free: false,
        desc: 'Offline written + online tie-breaker.',
        rules: ['Written paper at the school venue', 'Online tie-breaker the same evening'],
      },
      {
        name: 'Stage 3',
        mode: 'Peer Interview',
        pass: 60,
        price: 200,
        free: false,
        desc: 'Panel interview with peers and mentors.',
        rules: ['5 minutes per candidate', 'Carry your school ID'],
      },
    ],
  },
  {
    id: 'C03',
    title: 'National Finals',
    grades: '11-12',
    start: '2026-09-01',
    end: '2026-09-20',
    enrolled: 0,
    status: 'Draft',
    multi: false,
    desc: 'National finals — champions of each zone compete for the top scholarship.',
    stages: [
      {
        name: 'National Final',
        mode: 'Peer Interview',
        pass: 60,
        price: 250,
        free: false,
        desc: 'Grand finale interview + on-stage rapid fire.',
        rules: ['Formal attire', '30-minute slot including rapid fire'],
      },
    ],
  },
];

// Admin-managed grade/class options shown in every grade dropdown in the app.
const GRADES = [
  { name: '9', position: 1 },
  { name: '10', position: 2 },
  { name: '11', position: 3 },
  { name: '12', position: 4 },
  { name: '9-10', position: 5 },
  { name: '11-12', position: 6 },
  { name: '9-12', position: 7 },
  { name: 'All', position: 8 },
];

const SCHOOLS = [
  { code: 'S01', name: 'Amity International School, Saket', city: 'New Delhi', contact: '011-4000 0001', coordinator: 'Mrs. R. Khanna' },
  { code: 'S02', name: 'Amity International School, Noida', city: 'Noida', contact: '0120-400 0002', coordinator: 'Mr. S. Bhatia' },
  { code: 'S03', name: 'Amity International School, Gurugram 46', city: 'Gurugram', contact: '0124-400 0003', coordinator: 'Mrs. P. Anand' },
  { code: 'S04', name: 'Amity International School, Vasundhara', city: 'Ghaziabad', contact: '0120-400 0004', coordinator: 'Mr. A. Verma' },
  { code: 'S05', name: 'Amity International School, Mayur Vihar', city: 'New Delhi', contact: '011-4000 0005', coordinator: 'Mrs. K. Menon' },
];

// Registration rows double as student rows (Student.code === Registration.code in the static data).
const REGISTRATIONS = [
  { id: 'R1001', name: 'Aarav Mehta', grade: '9', school: 'Amity International School, Saket', parent: 'Rohit Mehta', phone: '9876500011', email: 'aarav.mehta@example.com', date: '2026-06-20', comp: 'C01', status: 'Qualified' },
  { id: 'R1002', name: 'Diya Sharma', grade: '10', school: 'Amity International School, Noida', parent: 'Neha Sharma', phone: '9876500012', email: 'diya.sharma@example.com', date: '2026-06-21', comp: 'C02', status: 'Test Taken' },
  { id: 'R1003', name: 'Kabir Rao', grade: '11', school: 'Amity International School, Gurugram 46', parent: 'Vikram Rao', phone: '9876500013', email: 'kabir.rao@example.com', date: '2026-06-21', comp: 'C01', status: 'Registered' },
  { id: 'R1004', name: 'Ananya Iyer', grade: '12', school: 'Amity International School, Vasundhara', parent: 'Suresh Iyer', phone: '9876500014', email: 'ananya.iyer@example.com', date: '2026-06-22', comp: 'C01', status: 'Qualified' },
  { id: 'R1005', name: 'Vivaan Gupta', grade: '9', school: 'Amity International School, Mayur Vihar', parent: 'Amit Gupta', phone: '9876500015', email: 'vivaan.gupta@example.com', date: '2026-06-23', comp: 'C02', status: 'Registered' },
  { id: 'R1006', name: 'Myra Nair', grade: '10', school: 'Amity International School, Saket', parent: 'Deepa Nair', phone: '9876500016', email: 'myra.nair@example.com', date: '2026-06-24', comp: 'C02', status: 'Test Taken' },
  { id: 'R1007', name: 'Reyansh Jain', grade: '11', school: 'Amity International School, Noida', parent: 'Pankaj Jain', phone: '9876500017', email: 'reyansh.jain@example.com', date: '2026-06-25', comp: 'C03', status: 'Registered' },
  { id: 'R1008', name: 'Saanvi Kapoor', grade: '12', school: 'Amity International School, Gurugram 46', parent: 'Karan Kapoor', phone: '9876500018', email: 'saanvi.kapoor@example.com', date: '2026-06-25', comp: 'C01', status: 'Qualified' },
];

const QUESTIONS = [
  { code: 'Q1', grade: '9', cat: 'IQ', type: 'text', media: '', mode: 'single', label: 'Series', ref: 'IQ-S01', limit: 60, comp: 'C01', q: 'Which number completes the series? 2, 6, 12, 20, 30, ___', opts: ['36', '40', '42', '48'], correct: [2] },
  { code: 'Q2', grade: '9', cat: 'IQ', type: 'text', media: '', mode: 'single', label: 'Coding', ref: 'IQ-S02', comp: 'C01', q: 'If CAT is coded as 3-1-20, what is the code for DOG?', opts: ['4-15-7', '4-14-7', '3-15-7', '4-15-8'], correct: [0] },
  { code: 'Q3', grade: '10', cat: 'IQ', type: 'text', media: '', mode: 'single', label: 'Odd One Out', ref: 'IQ-S03', comp: 'C02', q: 'Find the odd one out.', opts: ['Square', 'Circle', 'Triangle', 'Cube'], correct: [3] },
  { code: 'Q4', grade: '10', cat: 'EQ', type: 'text', media: '', mode: 'single', label: 'Empathy', ref: 'EQ-S01', comp: 'C01', q: 'A teammate is upset after losing a round. The best first response is to…', opts: ['Tell them to get over it', 'Acknowledge how they feel and offer support', 'Ignore them and move on', 'Point out their mistakes'], correct: [1] },
  { code: 'Q5', grade: '11', cat: 'EQ', type: 'text', media: '', mode: 'single', label: 'Stress', ref: 'EQ-S02', comp: 'C02', q: 'You feel nervous before a big test. A healthy way to handle it is to…', opts: ['Avoid the test', 'Take slow breaths and make a plan', 'Blame other people', 'Stay up all night worrying'], correct: [1] },
  { code: 'Q6', grade: '11', cat: 'Values', type: 'text', media: '', mode: 'single', label: 'Honesty', ref: 'VL-S01', comp: 'C01', q: 'You find a wallet that belongs to a classmate. What should you do?', opts: ['Keep it', 'Return it to them or a teacher', 'Spend the money', 'Leave it lying there'], correct: [1] },
  { code: 'Q7', grade: '12', cat: 'IQ', type: 'text', media: '', mode: 'single', label: 'Fractions', ref: 'IQ-S04', comp: 'C03', q: 'Which fraction is the largest?', opts: ['1/2', '2/5', '3/7', '4/9'], correct: [0] },
  { code: 'Q8', grade: '12', cat: 'Values', type: 'text', media: '', mode: 'single', label: 'Teamwork', ref: 'VL-S02', comp: 'C02', q: 'During a team task, the fairest way to decide is to…', opts: ['Let the loudest person choose', 'Listen to everyone and agree together', 'Always follow one leader', 'Decide in secret'], correct: [1] },
  { code: 'Q9', grade: '10', cat: 'IQ', type: 'video', media: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', mode: 'single', label: 'Patterns', ref: 'IQ-S05', limit: 90, comp: 'C02', q: 'Watch the video, then choose the next number in the sequence shown.', opts: ['14', '21', '28', '35'], correct: [1] },
  { code: 'Q10', grade: '9', cat: 'IQ', type: 'image', media: 'https://picsum.photos/seed/iml-shapes/800/450', mode: 'multi', label: 'Visual', ref: 'IQ-S06', comp: 'C03', q: 'Look at the picture. Select ALL the shapes that appear.', opts: ['Circle', 'Square', 'Triangle', 'Hexagon'], correct: [0, 1, 2] },
];

const EXAMS = [
  { code: 'E01', title: 'Digital Qualifier — Window 1', grade: '9-10', date: '2026-07-15', time: '10:00', duration: 15, timing: { mode: 'common', secs: 60 }, comp: 'C01', status: 'Scheduled' },
  { code: 'E02', title: 'Digital Qualifier — Window 2', grade: '11-12', date: '2026-07-16', time: '10:00', duration: 15, timing: { mode: 'common', secs: 60 }, comp: 'C01', status: 'Scheduled' },
  { code: 'E03', title: 'Practice Mock Test', grade: 'All', date: '2026-07-05', time: '17:00', duration: 15, timing: { mode: 'custom' }, comp: 'C02', status: 'Live' },
];

const PAYMENTS = [
  { code: 'PAY-1001', reg: 'R1001', mode: 'UPI', amount: 500, status: 'Paid' },
  { code: 'PAY-1002', reg: 'R1002', mode: 'Card', amount: 500, status: 'Paid' },
  { code: 'PAY-1003', reg: 'R1003', mode: 'Net Banking', amount: 500, status: 'Failed' },
  { code: 'PAY-1004', reg: 'R1004', mode: 'UPI', amount: 500, status: 'Paid' },
  { code: 'PAY-1005', reg: 'R1005', mode: 'UPI', amount: 500, status: 'Pending' },
  { code: 'PAY-1006', reg: 'R1006', mode: 'Card', amount: 500, status: 'Paid' },
  { code: 'PAY-1007', reg: 'R1007', mode: 'Net Banking', amount: 500, status: 'Failed' },
  { code: 'PAY-1008', reg: 'R1008', mode: 'UPI', amount: 500, status: 'Paid' },
];

const ANNOUNCEMENTS = [
  { code: 'AN1', title: 'Digital Qualifier windows confirmed', category: 'Exam', audience: 'All Registered', date: '2026-06-28', status: 'Active', pinned: true, message: 'Dear participant, your Digital Qualifier opens on 15 July at 10:00 AM. Log in from your dashboard and keep your credentials ready.' },
  { code: 'AN2', title: 'Practice mock test is now live', category: 'Exam', audience: 'Grades 9-12', date: '2026-06-27', status: 'Active', pinned: false, message: 'The practice mock test is live on the portal. Attempt it anytime before 14 July to familiarise yourself with the interface.' },
  { code: 'AN3', title: 'Coordinator briefing — IML Stage 1', category: 'Event', audience: 'Schools', date: '2026-06-25', status: 'Active', pinned: false, message: 'Dear coordinator, please find the Stage-1 schedule and guidelines attached. Reach out to your zonal contact for clarifications.' },
  { code: 'AN4', title: 'National Finals dates announced', category: 'Results', audience: 'Qualified only', date: '2026-06-22', status: 'Draft', pinned: false, message: 'National Finals will be held on 21-22 August. Venue and travel details will follow shortly.' },
];

const NEWS = [
  { code: 'NW1', title: 'Amity students shine in the IML 2026 Digital Qualifier', category: 'Press', author: 'PR Team', date: '2026-06-28', status: 'Published', photo: '', summary: 'Over 200 students across Amity schools cleared the online qualifier, with several perfect 5/5 scores.' },
  { code: 'NW2', title: 'IML partners with leading education brands for 2026', category: 'Media', author: 'Partnerships', date: '2026-06-24', status: 'Published', photo: '', summary: 'New sponsorship partners join India Mind League ahead of the School Zone Challenge.' },
  { code: 'NW3', title: 'Meet the quizmasters behind IML 2026', category: 'Competition', author: 'Editorial', date: '2026-06-20', status: 'Draft', photo: '', summary: 'Behind the scenes with the team writing the IQ, EQ and Values rounds.' },
  { code: 'NW4', title: 'IML 2026 season calendar is out', category: 'Competition', author: 'PR Team', date: '2026-06-15', status: 'Published', photo: '', summary: 'The full schedule of rounds, dates and venues for the 2026 season is now live on the website.' },
];

const GALLERY = [
  { code: 'GA1', name: 'National Finals 2025 Highlights', date: '2026-05-30', photos: 42, visibility: 'Public', cover: 'https://picsum.photos/seed/iml1/160', desc: 'Award ceremony and finale moments from the 2025 season.', status: 'Active' },
  { code: 'GA2', name: 'School Zone Challenge', date: '2026-06-18', photos: 28, visibility: 'Private', cover: 'https://picsum.photos/seed/iml2/160', desc: 'Round highlights from the School Zone Challenge across zones.', status: 'Active' },
  { code: 'GA3', name: 'Qualifier Season 2026', date: '2026-06-10', photos: 15, visibility: 'Public', cover: 'https://picsum.photos/seed/iml3/160', desc: 'Behind the scenes of the online qualifier season.', status: 'Active' },
];

const SPONSORS = [
  { code: 'SP01', name: 'TechNova Solutions', contact: 'R. Malhotra', email: 'r.malhotra@technova.in', phone: '9810010001', tier: 'Gold', status: 'Active', amount: 500000, since: '2026', events: ['C01', 'C03'] },
  { code: 'SP02', name: 'Apex EdTech', contact: 'Priya Sood', email: 'priya@apexedtech.in', phone: '9810010002', tier: 'Silver', status: 'Active', amount: 250000, since: '2026', events: ['C01', 'C02'] },
  { code: 'SP03', name: 'GreenLeaf Books', contact: 'Aman Verma', email: 'aman@greenleaf.in', phone: '9810010003', tier: 'Bronze', status: 'Disabled', amount: 75000, since: '2025', events: ['C02'] },
  { code: 'SP04', name: 'FutureBank', contact: 'Neha Kulkarni', email: 'neha@futurebank.in', phone: '9810010004', tier: 'Gold', status: 'Pending', amount: 400000, since: '2026', events: ['C03'] },
];

const PLANS = [
  { code: 'PL1', name: 'Platinum', min: 500000, benefits: 'Title sponsor · National Finals branding · Stage mentions · Logo on results', active: true, extras: ['Branded Booth Premium', 'Catalog Listing'] },
  { code: 'PL2', name: 'Gold', min: 250000, benefits: 'Co-sponsor branding · Logo on website & emails', active: true, extras: ['Branded Booth Basic'] },
  { code: 'PL3', name: 'Silver', min: 100000, benefits: 'Logo on website & newsletters', active: true, extras: [] },
  { code: 'PL4', name: 'Bronze', min: 50000, benefits: 'Listed on the sponsors page', active: true, extras: ['Branded Booth Corner'] },
];

const PRIZES = [
  { code: 'PR1', comp: 'C01', rank: '1st', money: 25000, award: 'Trophy', note: 'Winner trophy + certificate' },
  { code: 'PR2', comp: 'C01', rank: '2nd', money: 15000, award: 'Medal', note: '' },
  { code: 'PR3', comp: 'C01', rank: '3rd', money: 10000, award: 'Medal', note: '' },
  { code: 'PR4', comp: 'C01', rank: 'Consolation', money: 5000, award: 'Certificate', note: 'Top 10 finalists' },
  { code: 'PR5', comp: 'C02', rank: '1st', money: 10000, award: 'Trophy', note: '' },
  { code: 'PR6', comp: 'C02', rank: '2nd', money: 7000, award: 'Medal', note: '' },
  { code: 'PR7', comp: 'C02', rank: '3rd', money: 5000, award: 'Certificate', note: 'School zone toppers' },
  { code: 'PR8', comp: 'C03', rank: '1st', money: 50000, award: 'Scholarship', note: 'Winner scholarship' },
  { code: 'PR9', comp: 'C03', rank: '2nd', money: 30000, award: 'Trophy', note: '' },
  { code: 'PR10', comp: 'C03', rank: '3rd', money: 20000, award: 'Medal', note: '' },
];

const GRIEVANCES = [
  { code: 'GV1', type: 'Complaint', name: 'Aarav Mehta', contact: '9876500011', subject: 'Payment failed but amount deducted', message: 'I paid via UPI but the payment shows failed. The amount was deducted from my account. Please check and refund or confirm.', date: '2026-07-01', status: 'New' },
  { code: 'GV2', type: 'Feedback', name: 'Diya Sharma', contact: '9876500012', subject: 'Loved the quiz format!', message: 'The quiz was fun and well designed. The pictures made it interesting. Looking forward to the next round.', date: '2026-07-02', status: 'Resolved' },
  { code: 'GV3', type: 'Complaint', name: 'Kabir Rao', contact: '9876500013', subject: 'Result not showing after test', message: 'I finished my test but the result screen stayed blank. My attempt may not have been saved.', date: '2026-07-02', status: 'In Progress' },
  { code: 'GV4', type: 'Suggestion', name: 'Ananya Iyer', contact: '9876500014', subject: 'Add more practice mocks', message: 'It would help if you add more practice mock tests before the qualifier, especially for logical reasoning.', date: '2026-07-03', status: 'New' },
  { code: 'GV5', type: 'Feedback', name: 'Saanvi Kapoor', contact: '9876500018', subject: 'Coordinator support was quick', message: 'Our school coordinator got all queries resolved within a day. Great experience overall.', date: '2026-07-04', status: 'Resolved' },
  { code: 'GV6', type: 'Complaint', name: 'Myra Nair', contact: '9876500016', subject: 'Receipt email not received', message: 'I paid my registration fee but the receipt email never arrived. Please resend it.', date: '2026-07-05', status: 'New' },
];

const ADMINS = [
  { code: 'A01', name: 'Arjun Sharma', email: 'arjun@amity.edu', role: 'Super Admin', status: 'Active', modules: ['dash', 'comp', 'prize', 'gr', 'reg', 'sch', 'q', 'ex', 'nt', 'ad', 'lb', 'res'] },
  { code: 'A02', name: 'Priya Malhotra', email: 'priya@amity.edu', role: 'Editor', status: 'Active', modules: ['q', 'ex', 'res', 'lb'] },
  { code: 'A03', name: 'Rahul Bose', email: 'rahul@amity.edu', role: 'Viewer', status: 'Disabled', modules: ['q'] },
];

// qualifiers.js — stage attempts. Map reg-code -> [{stage pos, score}]
const QUALIFIERS: Record<string, Record<number, Array<[string, number]>>> = {
  C01: {
    1: [
      ['R1001', 42], ['R1002', 38], ['R1003', 30], ['R1004', 46],
      ['R1005', 44], ['R1006', 40], ['R1007', 36], ['R1008', 48],
    ],
    2: [
      ['R1001', 52], ['R1004', 48], ['R1005', 55], ['R1006', 45], ['R1008', 60],
    ],
  },
  C02: {
    1: [
      ['R1001', 55], ['R1002', 60], ['R1003', 42], ['R1005', 38],
      ['R1006', 45], ['R1008', 35],
    ],
    2: [
      ['R1001', 58], ['R1002', 52], ['R1003', 46], ['R1006', 40],
    ],
    3: [
      ['R1001', 64], ['R1002', 61],
    ],
  },
  C03: {},
};

async function main() {
  console.log('Seeding India Mind League…');

  // ---- wipe (FK order) ----
  await prisma.attemptAnswer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.registrationStage.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.grievance.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.question.deleteMany();
  await prisma.stageRule.deleteMany();
  await prisma.competitionStage.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.sponsorEvent.deleteMany();
  await prisma.sponsor.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.prize.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.news.deleteMany();
  await prisma.adminModule.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.student.deleteMany();
  await prisma.school.deleteMany();
  await prisma.grade.deleteMany();

  // ---- grades ----
  for (const g of GRADES) {
    await prisma.grade.create({ data: g });
  }

  // ---- schools ----
  const schoolIdByCode = new Map<string, number>();
  for (const s of SCHOOLS) {
    const created = await prisma.school.create({ data: { code: s.code, name: s.name, city: s.city, contact: s.contact, coordinator: s.coordinator } });
    schoolIdByCode.set(s.code, created.id);
  }

  // ---- students (from registration rows) ----
  for (const r of REGISTRATIONS) {
    const school = SCHOOLS.find((s) => s.name === r.school);
    await prisma.student.create({
      data: {
        code: r.id,
        name: r.name,
        grade: r.grade,
        schoolId: school ? schoolIdByCode.get(school.code) ?? null : null,
        phone: r.phone,
        email: r.email,
        parent: r.parent,
      },
    });
  }
  const studentByCode = new Map(REGISTRATIONS.map((r) => [r.id, r.name]));

  // ---- competitions + stages + rules ----
  const compStagePos: Record<string, Map<number, number>> = {}; // comp -> pos -> stageId
  for (const c of COMPETITIONS) {
    const comp = await prisma.competition.create({
      data: {
        code: c.id,
        title: c.title,
        grades: c.grades,
        startDate: new Date(c.start),
        endDate: new Date(c.end),
        status: c.status,
        isMulti: c.multi,
        description: c.desc,
      },
    });
    compStagePos[c.id] = new Map();
    for (const [i, st] of c.stages.entries()) {
      const stage = await prisma.competitionStage.create({
        data: {
          competitionId: comp.id,
          position: i + 1,
          name: st.name,
          mode: st.mode,
          passMark: st.pass,
          isFree: st.free !== false,
          price: st.price ?? 0,
          description: st.desc,
        },
      });
      compStagePos[c.id].set(i + 1, stage.id);
      for (const [ri, rule] of (st.rules ?? []).entries()) {
        await prisma.stageRule.create({
          data: { stageId: stage.id, rule, position: ri },
        });
      }
    }
  }
  const compIdByCode = new Map(COMPETITIONS.map((c, i) => [c.id, i + 1]));
  const schoolIdByName = new Map(SCHOOLS.map((s) => [s.name, parseInt(s.code.slice(1), 10)]));

  // ---- registrations (link to student + competition) ----
  for (const r of REGISTRATIONS) {
    const student = await prisma.student.findUnique({ where: { code: r.id } });
    const comp = await prisma.competition.findUnique({ where: { code: r.comp } });
    await prisma.registration.create({
      data: {
        code: r.id,
        studentId: student!.id,
        competitionId: comp!.id,
        status: r.status,
        registeredAt: new Date(r.date),
      },
    });
  }

  // ---- registration_stage (from qualifiers.js) ----
  for (const [compCode, stages] of Object.entries(QUALIFIERS)) {
    const comp = await prisma.competition.findUnique({ where: { code: compCode } });
    for (const [posStr, rows] of Object.entries(stages)) {
      const pos = parseInt(posStr, 10);
      const stage = await prisma.competitionStage.findUnique({
        where: { competitionId_position: { competitionId: comp!.id, position: pos } },
      });
      for (const [regCode, score] of rows) {
        const reg = await prisma.registration.findUnique({ where: { code: regCode } });
        if (!reg) continue;
        const pass = stage!.passMark;
        const qualified = new Prisma.Decimal(score).gte(pass);
        await prisma.registrationStage.create({
          data: {
            registrationId: reg!.id,
            stageId: stage!.id,
            status: qualified ? 'Qualified' : 'Eliminated',
            score,
            qualified,
          },
        });
      }
    }
  }

  // ---- questions ----
  const qIdByCode = new Map<string, number>();
  for (const q of QUESTIONS) {
    const comp = await prisma.competition.findUnique({ where: { code: q.comp } });
    const created = await prisma.question.create({
      data: {
        code: q.code,
        competitionId: comp?.id ?? null,
        grade: q.grade,
        category: q.cat,
        qtype: q.type,
        media: q.media || null,
        mode: q.mode,
        label: q.label,
        ref: q.ref,
        timeLimitSecs: q.limit ?? null,
        prompt: q.q,
        options: q.opts as unknown as Prisma.InputJsonValue,
        correct: q.correct as unknown as Prisma.InputJsonValue,
      },
    });
    qIdByCode.set(q.code, created.id);
  }

  // ---- exams ----
  for (const e of EXAMS) {
    const comp = await prisma.competition.findUnique({ where: { code: e.comp } });
    await prisma.exam.create({
      data: {
        code: e.code,
        competitionId: comp?.id ?? null,
        title: e.title,
        grade: e.grade,
        date: new Date(e.date),
        time: new Date(`2000-01-01T${e.time}:00Z`),
        durationMin: e.duration,
        timing: e.timing as unknown as Prisma.InputJsonValue,
        status: e.status,
      },
    });
  }

  // ---- payments (link registration) ----
  for (const p of PAYMENTS) {
    const reg = await prisma.registration.findUnique({ where: { code: p.reg } });
    await prisma.payment.create({
      data: {
        code: p.code,
        registrationId: reg!.id,
        amount: p.amount,
        mode: p.mode,
        status: p.status,
        paidAt: p.status === 'Paid' ? new Date('2026-06-25T12:00:00Z') : null,
      },
    });
  }

  // ---- announcements / news / gallery ----
  for (const a of ANNOUNCEMENTS) {
    await prisma.announcement.create({
      data: {
        code: a.code,
        title: a.title,
        category: a.category,
        audience: a.audience,
        publishOn: new Date(a.date),
        status: a.status,
        pinned: a.pinned,
        message: a.message,
      },
    });
  }
  for (const n of NEWS) {
    await prisma.news.create({
      data: {
        code: n.code,
        title: n.title,
        category: n.category,
        author: n.author,
        publishOn: new Date(n.date),
        status: n.status,
        photo: n.photo || null,
        summary: n.summary,
      },
    });
  }
  for (const g of GALLERY) {
    await prisma.gallery.create({
      data: {
        code: g.code,
        name: g.name,
        date: new Date(g.date),
        visibility: g.visibility,
        cover: g.cover,
        description: g.desc,
        status: g.status,
      },
    });
  }

  // ---- sponsors + events ----
  for (const s of SPONSORS) {
    const sp = await prisma.sponsor.create({
      data: {
        code: s.code,
        name: s.name,
        contact: s.contact,
        email: s.email,
        phone: s.phone,
        tier: s.tier,
        status: s.status,
        amount: s.amount,
        since: s.since,
      },
    });
    for (const ev of s.events) {
      const comp = await prisma.competition.findUnique({ where: { code: ev } });
      if (comp) {
        await prisma.sponsorEvent.create({
          data: { sponsorId: sp.id, competitionId: comp.id },
        });
      }
    }
  }

  // ---- plans ----
  for (const p of PLANS) {
    await prisma.plan.create({
      data: {
        code: p.code,
        name: p.name,
        minAmount: p.min,
        benefits: p.benefits,
        extras: p.extras as unknown as Prisma.InputJsonValue,
        active: p.active,
      },
    });
  }

  // ---- prizes ----
  for (const p of PRIZES) {
    const comp = await prisma.competition.findUnique({ where: { code: p.comp } });
    await prisma.prize.create({
      data: {
        code: p.code,
        competitionId: comp!.id,
        rankLabel: p.rank,
        money: p.money,
        award: p.award,
        note: p.note || null,
      },
    });
  }

  // ---- grievances (link student by name when possible) ----
  for (const g of GRIEVANCES) {
    const student = await prisma.student.findFirst({ where: { name: g.name } });
    await prisma.grievance.create({
      data: {
        code: g.code,
        gtype: g.type,
        studentId: student?.id ?? null,
        name: g.name,
        contact: g.contact,
        subject: g.subject,
        message: g.message,
        status: g.status,
        createdAt: new Date(`${g.date}T09:00:00Z`),
      },
    });
  }

  // ---- admins (real argon2id hashes, dev password Admin@123) ----
  for (const a of ADMINS) {
    const admin = await prisma.admin.create({
      data: {
        name: a.name,
        email: a.email,
        passwordHash: await argonHash(DEV_ADMIN_PASSWORD),
        role: a.role,
        status: a.status,
      },
    });
    for (const m of a.modules) {
      await prisma.adminModule.create({
        data: { adminId: admin.id, moduleCode: m },
      });
    }
  }

  // ---- leaderboard view (postgres) ----
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW leaderboard AS
    SELECT
      a.code          AS attempt_code,
      r.competition_id,
      a.score,
      a.total,
      s.name          AS student,
      s.grade,
      sc.name         AS school
    FROM attempts a
    JOIN registrations r ON r.id = a.registration_id
    JOIN students s     ON s.id = r.student_id
    LEFT JOIN schools sc ON sc.id = s.school_id
  `);
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW dashboard_summary AS
    SELECT
      (SELECT count(*) FROM registrations)                    AS registrations,
      (SELECT count(*) FROM competitions)                     AS competitions,
      (SELECT count(*) FROM questions)                        AS questions,
      (SELECT count(*) FROM exams WHERE status = 'Scheduled') AS upcoming_exams,
      (SELECT count(*) FROM students)                         AS students,
      (SELECT count(*) FROM payments WHERE status = 'Paid')   AS paid_payments
  `);

  const counts = await prisma.student.count();
  const comps = await prisma.competition.count();
  console.log(`Seeded OK — ${comps} competitions, ${counts} students.`);
  console.log(`Admin login: use email + password "${DEV_ADMIN_PASSWORD}" (all seeded admins).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * India Mind League — message template seed.
 * Source: "INDIA MIND LEAGUE - WEBSITE REPLY.docx" (communication flow spec).
 *
 * Unlike seed.ts this is NON-DESTRUCTIVE — it only upserts the template
 * rows below by key, touching nothing else. Safe to run against a live
 * database with real data (including production).
 *
 * Run with:  npx ts-node prisma/seed-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function p(text: string): string {
  return `<p>${text}</p>`;
}

const TEMPLATES: Array<{
  key: string;
  label: string;
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
}> = [
  {
    key: 'REGISTRATION_OTP',
    label: 'Registration / Login OTP',
    smsBody:
      'India Mind League OTP: {OTP}. Valid for 10 minutes. Do not share this OTP with anyone. - India Mind League',
    // SMS-only in the original spec, but SMS delivery is blocked on pending
    // DLT approval — this is the only channel that actually works today.
    emailSubject: 'Your India Mind League Verification Code',
    emailBody: [
      p('Dear Student,'),
      p('Use the code below to verify your email and complete your India Mind League registration.'),
      p('<strong style="font-size:1.4em;letter-spacing:0.2em;">{OTP}</strong>'),
      p('This code is valid for 10 minutes. Do not share it with anyone.'),
      p('If you did not request this, you can safely ignore this email.'),
    ].join(''),
  },
  {
    key: 'REGISTRATION_SUCCESSFUL',
    label: 'Registration Successful',
    smsBody:
      'Welcome to India Mind League, {Name}! Your registration is successful. Registration ID: {RegID}. Login to view your dashboard.',
    emailSubject: 'Welcome to India Mind League | Registration Confirmed',
    emailBody: [
      p('Dear {StudentName},'),
      p('Welcome to India Mind League &ndash; India&rsquo;s Intellectual &amp; Leadership Championship for School Students.'),
      p('Your registration has been completed successfully.'),
      p('<strong>Registration Details:</strong><br/>Student Name: {StudentName}<br/>Registration ID: {RegID}<br/>Class: {Class}<br/>School: {SchoolName}'),
      p('Please keep your Registration ID safe for all future communication.'),
      p('You can login to your dashboard to view your registration details, assessment updates and important announcements.'),
      p('Login: {LoginLink}'),
      p('Get ready to Think. Feel. Understand. Lead.'),
      p('Warm regards,<br/>Team India Mind League<br/>Where Knowledge Meets Leadership.'),
    ].join(''),
  },
  {
    key: 'PAYMENT_SUCCESSFUL',
    label: 'Payment Successful',
    smsBody:
      'Payment received for India Mind League. Amount: Rs {Amount}. Registration ID: {RegID}. Your payment receipt is available on your dashboard.',
    emailSubject: 'Payment Confirmed | India Mind League',
    emailBody: [
      p('Dear {StudentName},'),
      p('Thank you. We have successfully received your payment for India Mind League.'),
      p('<strong>Payment Details:</strong><br/>Registration ID: {RegID}<br/>Amount Paid: &#8377;{Amount}<br/>Transaction ID: {TransactionID}<br/>Payment Date: {PaymentDate}'),
      p('Your payment receipt can be viewed/downloaded from your dashboard.'),
      p('Dashboard: {DashboardLink}'),
      p('Your registration is now confirmed.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'PAYMENT_FAILED',
    label: 'Payment Failed',
    smsBody:
      'Your India Mind League payment was not completed. Please login and retry payment. If already debited, contact support with your Registration ID.',
    emailSubject: 'Action Required | India Mind League Payment Incomplete',
    emailBody: [
      p('Dear {StudentName},'),
      p('We were unable to complete the payment for your India Mind League registration.'),
      p('Registration ID: {RegID}'),
      p('Please login to your dashboard and retry the payment.'),
      p('Retry Payment: {PaymentLink}'),
      p('If the amount has already been deducted from your account, please do not make repeated payments. Contact our support team with your Registration ID and transaction details.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'STAGE1_SCHEDULE',
    label: 'Stage 1 Schedule',
    smsBody:
      'India Mind League Stage 1 is scheduled on {Date} at {Time}. Login early and keep your Registration ID ready. Best wishes!',
    emailSubject: 'Your India Mind League Stage 1 Assessment Details',
    emailBody: [
      p('Dear {StudentName},'),
      p('Your India Mind League &ndash; Stage 1 Online Challenge has been scheduled.'),
      p('<strong>Assessment Details:</strong><br/>Date: {Date}<br/>Time: {Time}<br/>Duration: {Duration}<br/>Registration ID: {RegID}<br/>Assessment Link: {AssessmentLink}'),
      p('The challenge will assess multiple dimensions of future-ready intelligence.'),
      p('Please login at least 15 minutes before the scheduled time and ensure you have a stable internet connection.'),
      p('We wish you the very best.<br/>Think smart. Respond wisely. Lead forward.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'STAGE1_REMINDER',
    label: 'Stage 1 Reminder',
    smsBody:
      'Reminder: India Mind League Stage 1 begins on {Date} at {Time}. Please login 15 minutes early and ensure a stable internet connection.',
    emailSubject: 'Reminder | Your India Mind League Stage 1 Challenge',
    emailBody: [
      p('Dear {StudentName},'),
      p('This is a reminder that your India Mind League Stage 1 Online Challenge is scheduled for:'),
      p('Date: {Date}<br/>Time: {Time}'),
      p('Please login at least 15 minutes early.<br/>Assessment Link: {AssessmentLink}'),
      p('Before you begin, please ensure:<br/>&bull; Stable internet connection<br/>&bull; Compatible laptop/desktop/mobile device as prescribed<br/>&bull; Quiet environment<br/>&bull; Your Registration ID is available<br/>&bull; You read all assessment instructions carefully'),
      p('Best wishes!<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'STAGE1_SUBMITTED',
    label: 'Stage 1 Submitted',
    // Deliberately carries no score/result and no qualify/not-qualify
    // verdict — client requirement (2026-09-03): the completion email must
    // never reveal the outcome ahead of the dashboard, since a capacity-
    // limited stage's real result isn't decided until an admin runs Next
    // Stage Selection. Exact wording as specified by the client.
    smsBody:
      'Thank you for completing the India Mind League - Assessment. Your result will be updated on your dashboard.',
    emailSubject: 'Thank You for Completing the India Mind League Assessment',
    emailBody: [
      p('Dear {StudentName},'),
      p('Thank you for completing the India Mind League – Assessment.'),
      p('Your result will be updated on your dashboard.'),
      p('You can also download your Participation Certificate from the dashboard.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'QUALIFIED_STAGE2',
    label: 'Qualified for Stage 2',
    smsBody:
      'Congratulations {Name}! You have qualified for India Mind League Stage 2 - Zoom Showdown. Check your email/dashboard for schedule and instructions.',
    emailSubject: 'Congratulations! You Have Qualified for India Mind League Stage 2',
    emailBody: [
      p('Dear {StudentName},'),
      p('<strong>Congratulations!</strong>'),
      p('Your performance in the India Mind League Stage 1 Online Challenge has earned you a place in:'),
      p('<strong>STAGE 2 &ndash; ZOOM SHOWDOWN</strong>'),
      p('This stage will challenge your ability to think, reason, respond, communicate and make decisions in real time.'),
      p('<strong>Stage 2 Details:</strong><br/>Date: {Date}<br/>Time: {Time}<br/>Joining Link: {ZoomLink}<br/>Reporting Time: {ReportingTime}'),
      p('Please join at least 15 minutes before the scheduled start time.'),
      p('Further instructions are available on your dashboard.'),
      p('You have moved one step closer to becoming an India Mind League Finalist.'),
      p('Warm congratulations,<br/>Team India Mind League<br/>Where Knowledge Meets Leadership.'),
    ].join(''),
  },
  {
    key: 'NOT_QUALIFIED_STAGE2',
    label: 'Not Qualified for Stage 2',
    smsBody:
      'Thank you for participating in India Mind League, {Name}. You have not advanced to Stage 2. Your participation certificate will be shared soon.',
    emailSubject: 'Thank You for Participating | India Mind League',
    emailBody: [
      p('Dear {StudentName},'),
      p('Thank you for being part of the India Mind League Stage 1 Online Challenge.'),
      p('While you have not advanced to the next stage this time, participating in the challenge itself reflects your willingness to test your thinking beyond conventional academics.'),
      p('We encourage you to continue strengthening your:<br/>IQ | EQ | SQ | LQ'),
      p('Your participation certificate will be made available through your dashboard.'),
      p('Keep learning. Keep questioning. Keep leading.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'STAGE2_REMINDER',
    label: 'Stage 2 Reminder',
    smsBody:
      'Reminder: India Mind League Stage 2 - Zoom Showdown is on {Date} at {Time}. Join using the link on your dashboard 15 minutes early.',
    emailSubject: 'Reminder | India Mind League Stage 2 – Zoom Showdown',
    emailBody: [
      p('Dear {StudentName},'),
      p('Your India Mind League Stage 2 &ndash; Zoom Showdown is scheduled for:'),
      p('Date: {Date}<br/>Time: {Time}<br/>Reporting Time: {ReportingTime}<br/>Join Here: {ZoomLink}'),
      p('Please ensure your:<br/>&bull; Camera and microphone are working<br/>&bull; Internet connection is stable<br/>&bull; Display name matches your registered name<br/>&bull; Registration ID is available<br/>&bull; You join from a quiet environment'),
      p('Please report at least 15 minutes early.'),
      p('Best wishes,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'QUALIFIED_BOOTCAMP',
    label: 'Qualified for Leadership Bootcamp',
    smsBody:
      'Congratulations {Name}! You have qualified for the India Mind League Leadership Bootcamp. Check your dashboard for fee, schedule and next steps.',
    emailSubject: 'Congratulations! You Have Qualified for the India Mind League Leadership Bootcamp',
    emailBody: [
      p('Dear {StudentName},'),
      p('Congratulations on your outstanding performance.'),
      p('You have qualified for the India Mind League Leadership Bootcamp.'),
      p('The Bootcamp is designed to help selected students move beyond competition into experiential development across:'),
      p('IQ &ndash; Intellectual Intelligence<br/>EQ &ndash; Emotional Intelligence<br/>SQ &ndash; Social Intelligence<br/>LQ &ndash; Leadership Intelligence'),
      p('It will include expert-led learning, interactive challenges, communication, leadership experiences, future skills and mentorship.'),
      p('Bootcamp Fee: &#8377;{Amount}<br/>Payment Deadline: {DueDate}<br/>Confirm Participation: {PaymentLink}'),
      p('Detailed schedule and joining/venue instructions will be available on your dashboard.'),
      p('Welcome to the next level of India Mind League.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'BOOTCAMP_PAYMENT_DUE',
    label: 'Bootcamp Payment Due / Reminder',
    smsBody:
      'India Mind League Bootcamp fee of Rs {Amount} is due by {DueDate}. Login to your dashboard to complete payment and confirm participation.',
    emailSubject: 'Action Required | Confirm Your India Mind League Leadership Bootcamp Seat',
    emailBody: [
      p('Dear {StudentName},'),
      p('Your selection for the India Mind League Leadership Bootcamp has been confirmed.'),
      p('To secure your participation, please complete the Bootcamp fee payment by:'),
      p('Deadline: {DueDate}<br/>Fee: &#8377;{Amount}<br/>Pay Now: {PaymentLink}'),
      p('Your participation will be treated as confirmed after successful payment.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'BOOTCAMP_CONFIRMED',
    label: 'Bootcamp Participation Confirmed',
    smsBody:
      'Your India Mind League Leadership Bootcamp participation is confirmed. Date: {Date}. Venue/details are available on your dashboard.',
    emailSubject: 'Confirmed! Your India Mind League Leadership Bootcamp Journey Begins',
    emailBody: [
      p('Dear {StudentName},'),
      p('Your participation in the India Mind League Leadership Bootcamp is now confirmed.'),
      p('Student: {StudentName}<br/>Registration ID: {RegID}<br/>Date: {Date}<br/>Reporting Time: {Time}<br/>Venue / Joining Details: {VenueOrLink}'),
      p('Please refer to your dashboard for detailed instructions.'),
      p('Prepare yourself for an immersive journey of:<br/>Thinking &rarr; Understanding &rarr; Communicating &rarr; Collaborating &rarr; Leading'),
      p('We look forward to welcoming you.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'GRAND_FINALE_QUALIFIED',
    label: 'Qualified for Grand Finale',
    smsBody:
      'Congratulations {Name}! You have qualified for the India Mind League Grand Finale. Check your email/dashboard for reporting time and instructions.',
    emailSubject: 'Congratulations! You Are an India Mind League Grand Finalist',
    emailBody: [
      p('Dear {StudentName},'),
      p('<strong>Congratulations!</strong>'),
      p('You have successfully qualified for the India Mind League Grand Finale.'),
      p('Your journey through multiple stages of intellectual, emotional, social and leadership challenges has brought you to the championship stage.'),
      p('<strong>Grand Finale Details:</strong><br/>Date: {Date}<br/>Time: {Time}<br/>Reporting Time: {ReportingTime}<br/>Venue / Joining Details: {VenueOrLink}'),
      p('Please review the finalist instructions available on your dashboard carefully.'),
      p('This is your moment to:<br/>THINK. RESPOND. INSPIRE. LEAD.'),
      p('Wishing you an exceptional finale.'),
      p('Warm regards,<br/>Team India Mind League<br/>Where Knowledge Meets Leadership.'),
    ].join(''),
  },
  {
    key: 'GRAND_FINALE_REMINDER',
    label: 'Grand Finale Reminder',
    smsBody:
      'Reminder: India Mind League Grand Finale is on {Date} at {Time}. Please report/join as instructed in your email and dashboard. Best wishes!',
    emailSubject: 'Final Reminder | India Mind League Grand Finale',
    emailBody: [
      p('Dear {StudentName},'),
      p('The India Mind League Grand Finale is almost here.'),
      p('Date: {Date}<br/>Time: {Time}<br/>Reporting Time: {ReportingTime}<br/>Venue / Joining Details: {VenueOrLink}'),
      p('Please follow all finalist instructions and report on time.'),
      p('Bring your confidence, curiosity, clarity and leadership spirit.'),
      p('The stage is yours.'),
      p('Best wishes,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'WINNER_COMMUNICATION',
    label: 'Winner Communication',
    // Email-only in the spec — no SMS body.
    emailSubject: 'Congratulations! You Are an India Mind League Champion',
    emailBody: [
      p('Dear {StudentName},'),
      p('<strong>CONGRATULATIONS!</strong>'),
      p('We are delighted to announce that you have emerged as {Position_Title} at the India Mind League Grand Finale.'),
      p('Your achievement represents much more than knowledge&mdash;it reflects your ability to think critically, respond intelligently, understand perspectives and lead with confidence.'),
      p('Your award/prize details will be communicated separately and will also be available through your dashboard.'),
      p('Congratulations to you, your parents and your school.'),
      p('Keep thinking forward. Keep leading forward.'),
      p('Warm regards,<br/>Team India Mind League<br/>Where Knowledge Meets Leadership.'),
    ].join(''),
  },
  {
    key: 'CERTIFICATE_AVAILABLE',
    label: 'Certificate Available',
    smsBody:
      'Your India Mind League certificate is now available. Login to your dashboard to view and download it. Thank you for being part of the League.',
    emailSubject: 'Your India Mind League Certificate Is Ready',
    emailBody: [
      p('Dear {StudentName},'),
      p('Thank you for being part of India Mind League.'),
      p('Your {CertificateType} Certificate is now available.'),
      p('Download Certificate: {CertificateLink}'),
      p('We hope the India Mind League journey inspires you to continue strengthening your intelligence, empathy, social understanding and leadership abilities.'),
      p('Beyond Marks. Beyond Limits.'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'EXAM_REMINDER_GET_READY',
    label: 'Exam Batch Reminder — Get Ready',
    smsBody:
      'Hi {StudentName}, this is a reminder that your online test will start at {ExamTime}. Make sure to login 5 minutes earlier. Good luck!! - India Mind League',
    emailSubject: 'Get Ready! Your India Mind League Test Starts Soon',
    emailBody: [
      p('Hi {StudentName},'),
      p('This is a reminder that your online test will start at <strong>{ExamTime}</strong>.'),
      p('Make sure to login 5 minutes earlier.'),
      p('Good luck!!'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'EXAM_REMINDER_GO_FOR_IT',
    label: 'Exam Batch Reminder — Go For It',
    smsBody:
      'Hi {StudentName}, your online exam window is now open. It will close at {CloseTime}. Take the test now: {TestLink} Good luck! - India Mind League',
    emailSubject: 'Your India Mind League Test Window Is Open — Go For It!',
    emailBody: [
      p('Hi {StudentName},'),
      p('Your online exam window is now open. It will close at <strong>{CloseTime}</strong>.'),
      p('<a href="{TestLink}" style="display:inline-block;padding:0.7em 1.4em;background:#e8b64a;color:#241a02;border-radius:8px;text-decoration:none;font-weight:700;">Take The Test Now</a>'),
      p('Or copy this link: {TestLink}'),
      p('Good luck!'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'PASSWORD_RESET_OTP',
    label: 'Password Reset OTP',
    smsBody:
      'India Mind League password reset OTP: {OTP}. Valid for 10 minutes. Do not share it with anyone. Ignore this message if you did not request it.',
    emailSubject: 'Reset Your India Mind League Password',
    emailBody: [
      p('Dear {StudentName},'),
      p('We received a request to reset the password for your India Mind League account.'),
      p('Your OTP is:'),
      p('<strong>{OTP}</strong>'),
      p('The OTP is valid for 10 minutes.'),
      p('Please do not share this OTP with anyone.'),
      p('If you did not request a password reset, you may safely ignore this email.'),
    ].join(''),
  },
  {
    key: 'GRIEVANCE_RECEIVED',
    label: 'Help Desk — Ticket Received (student ack.)',
    emailSubject: 'We’ve received your Help Desk request — Ticket {TicketID}',
    emailBody: [
      p('Dear {StudentName},'),
      p('Thank you for reaching out to the India Mind League Help Desk. We’ve received your request and a member of our team will get back to you shortly.'),
      p('<strong>Ticket Details:</strong><br/>Ticket ID: {TicketID}<br/>Type: {Type}<br/>Subject: {Subject}'),
      p('You can track this ticket and see our reply any time from your dashboard.'),
      p('Track your ticket: {HelpDeskLink}'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'GRIEVANCE_ADMIN_ALERT',
    label: 'Help Desk — New Ticket (internal alert)',
    emailSubject: 'New Help Desk ticket {TicketID} — {Type}',
    emailBody: [
      p('A new Help Desk ticket has been raised.'),
      p('<strong>Ticket:</strong> {TicketID}<br/><strong>Student:</strong> {StudentName} ({StudentCode})<br/><strong>Type:</strong> {Type}<br/><strong>Subject:</strong> {Subject}'),
      p('<strong>Message:</strong><br/>{Message}'),
      p('Reply from the admin panel: Admin → Grievances.'),
    ].join(''),
  },
  {
    key: 'GRIEVANCE_STUDENT_REPLIED',
    label: 'Help Desk — Student Replied (internal alert)',
    emailSubject: 'Student replied on ticket {TicketID}',
    emailBody: [
      p('{StudentName} ({StudentCode}) has replied on an existing Help Desk ticket.'),
      p('<strong>Ticket:</strong> {TicketID}<br/><strong>Subject:</strong> {Subject}'),
      p('<strong>Message:</strong><br/>{Message}'),
      p('Reply from the admin panel: Admin → Grievances.'),
    ].join(''),
  },
  {
    key: 'GRIEVANCE_REPLIED',
    label: 'Help Desk — Admin Replied (student notice)',
    emailSubject: 'New reply on your Help Desk ticket {TicketID}',
    emailBody: [
      p('Dear {StudentName},'),
      p('You have a new reply on your Help Desk ticket.'),
      p('<strong>Ticket:</strong> {TicketID}<br/><strong>Subject:</strong> {Subject}'),
      p('<strong>Reply:</strong><br/>{ReplyMessage}'),
      p('View the full conversation and reply back: {HelpDeskLink}'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
  {
    key: 'GRIEVANCE_STATUS_CHANGED',
    label: 'Help Desk — Status Changed (student notice)',
    emailSubject: 'Your Help Desk ticket {TicketID} is now {NewStatus}',
    emailBody: [
      p('Dear {StudentName},'),
      p('The status of your Help Desk ticket has been updated.'),
      p('<strong>Ticket:</strong> {TicketID}<br/><strong>Subject:</strong> {Subject}<br/><strong>New Status:</strong> {NewStatus}'),
      p('View the full ticket: {HelpDeskLink}'),
      p('Warm regards,<br/>Team India Mind League'),
    ].join(''),
  },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        label: t.label,
        smsBody: t.smsBody ?? null,
        emailSubject: t.emailSubject ?? null,
        emailBody: t.emailBody ?? null,
      },
      // Existing admin edits to the body copy are preserved — re-running
      // this only fills in rows that don't exist yet or refreshes the label.
      update: { label: t.label },
    });
  }
  console.log(`Upserted ${TEMPLATES.length} message templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

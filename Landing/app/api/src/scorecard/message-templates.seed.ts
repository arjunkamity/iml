// The two notification templates the scorecard release flow sends (#74). Created only when
// missing: wording an admin has since edited under Messaging is never overwritten.
import { PrismaClient } from '@prisma/client';

const p = (text: string) => `<p>${text}</p>`;

export const SCORECARD_MESSAGE_TEMPLATES = [
  {
    key: 'SCORECARD_REPORT_READY',
    label: 'Scorecard report released (student)',
    smsBody: 'India Mind League: {StudentName}, your {StageName} Future Readiness report is ready. Sign in to view it: {ReportLink}',
    emailSubject: 'Your India Mind League Future Readiness report is ready',
    emailBody: [
      p('Dear {StudentName},'),
      p('Your Future Readiness report for <strong>{StageName}</strong> is ready.'),
      p('Sign in to your India Mind League account to view and download it: <a href="{ReportLink}">{ReportLink}</a>'),
    ].join(''),
  },
  {
    key: 'SCORECARD_REPORT_PARENT',
    label: 'Scorecard report link (parent)',
    smsBody: 'India Mind League: {StudentName}\'s {StageName} report is ready. Open: {ReportLink} Code: {Code} (valid {Days} days)',
  },
  {
    key: 'PANEL_INVITE',
    label: 'Panelist invitation or password reset',
    smsBody: 'India Mind League: {Name}, use this link to {Purpose}: {InviteLink} (valid {Days} day(s))',
    emailSubject: 'India Mind League panel: {Purpose}',
    emailBody: [
      p('Dear {Name},'),
      p('You have been invited to the India Mind League evaluation panel.'),
      p('Use this link to {Purpose}: <a href="{InviteLink}">{InviteLink}</a>'),
      p('The link works for {Days} day(s).'),
    ].join(''),
  },
  {
    key: 'PANEL_LOGIN_OTP',
    label: 'Panel sign-in code',
    smsBody: 'India Mind League panel sign-in code: {OTP}. Valid for 10 minutes. Do not share it.',
    emailSubject: 'Your India Mind League panel sign-in code',
    emailBody: [p('Dear {Name},'), p('Your sign-in code is <strong style="font-size:1.4em;letter-spacing:0.2em;">{OTP}</strong>'), p('It is valid for 10 minutes. Do not share it with anyone.')].join(''),
  },
  {
    key: 'PANEL_REMINDER',
    label: 'Panel rating reminder',
    smsBody: 'India Mind League: {Name}, you still have {Pending} student(s) to rate in {StageName} ({CompetitionTitle}). {PanelLink}',
    emailSubject: 'Reminder: {Pending} student(s) waiting for your rating',
    emailBody: [p('Dear {Name},'), p('You still have {Pending} student(s) to rate in <strong>{StageName}</strong> ({CompetitionTitle}).'), p('Open the panel: <a href="{PanelLink}">{PanelLink}</a>')].join(''),
  },
];

export async function seedScorecardMessageTemplates(prisma: PrismaClient) {
  const created: string[] = [];
  for (const t of SCORECARD_MESSAGE_TEMPLATES) {
    if (await prisma.messageTemplate.findUnique({ where: { key: t.key } })) continue;
    await prisma.messageTemplate.create({ data: { ...t, active: true } });
    created.push(t.key);
  }
  return { created };
}

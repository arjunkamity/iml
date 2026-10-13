import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService as Dispatcher } from '../../messaging/messaging.service';
import { formatIstDate } from '../../common/util';
import { UpdateMessageTemplateDto, TestSendDto } from './messaging.dto';

// Sample values so "Send Test" works for any of the 17 templates without
// the admin having to know which {Placeholder} tokens a given body uses.
const SAMPLE_VARS: Record<string, string> = {
  Name: 'Test Student',
  StudentName: 'Test Student',
  RegID: 'R9999',
  OTP: '123456',
  Amount: '500',
  TransactionID: 'TEST-TXN-001',
  PaymentDate: formatIstDate(),
  DueDate: formatIstDate(),
  Date: formatIstDate(),
  Time: '10:00 AM',
  Duration: '60 minutes',
  Class: '10',
  SchoolName: 'Test School',
  ReportingTime: '9:45 AM',
  Position_Title: 'Champion',
  'Position/Title': 'Champion',
  CertificateType: 'Participation',
  VenueOrLink: 'https://example.com/venue',
  LoginLink: 'https://indiamindleague.com/login',
  DashboardLink: 'https://indiamindleague.com/account',
  PaymentLink: 'https://indiamindleague.com/account/payments',
  AssessmentLink: 'https://indiamindleague.com/account/exam',
  ZoomLink: 'https://zoom.us/j/000000000',
  CertificateLink: 'https://indiamindleague.com/account',
};

@Injectable()
export class AdminMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: Dispatcher,
  ) {}

  listTemplates() {
    return this.prisma.messageTemplate.findMany({ orderBy: { id: 'asc' } });
  }

  async getTemplate(key: string) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { key } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(key: string, dto: UpdateMessageTemplateDto) {
    await this.getTemplate(key);
    return this.prisma.messageTemplate.update({ where: { key }, data: dto });
  }

  async testSend(key: string, dto: TestSendDto) {
    await this.getTemplate(key);
    if (!dto.email && !dto.phone) {
      throw new NotFoundException('Provide an email and/or phone to test with');
    }
    await this.dispatcher.dispatch(key, { email: dto.email, phone: dto.phone }, SAMPLE_VARS);
    return { ok: true };
  }

  listLogs(templateKey?: string, take = 100) {
    return this.prisma.messageLog.findMany({
      where: templateKey ? { templateKey } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }
}

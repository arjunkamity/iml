import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DispatchTarget {
  email?: string | null;
  phone?: string | null;
}

export type TemplateVars = Record<string, string | number | null | undefined>;

/**
 * Sends the 17 lifecycle notifications (registration, payment, stage
 * progress, ...) via two real third-party providers:
 *   - Email: Falconide (`web.send.rest`) — contract confirmed against their
 *     published API guide.
 *   - SMS: ConnectExpress (`api/v3`) — contract taken from a working legacy
 *     C# integration (no public docs exist). DLT template approval for the
 *     AMITY sender ID is still pending as of 2026-08-17, so SMS sends may be
 *     rejected by the gateway — every attempt is logged with the provider's
 *     raw response regardless of outcome, nothing here assumes success.
 *
 * dispatch() never throws: a notification failure must never break the
 * registration/payment/exam flow that triggered it.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private render(body: string, vars: TemplateVars): string {
    return body.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const v = vars[key];
      return v === null || v === undefined ? '' : String(v);
    });
  }

  /** Look up a template by key, render both channel bodies, send to
   *  whichever of target.email/target.phone are present, and log each
   *  attempt. Silently no-ops if the template is missing/inactive or has no
   *  body for a channel. */
  async dispatch(key: string, target: DispatchTarget, vars: TemplateVars = {}): Promise<void> {
    // A single, centralized guard rather than checking at each of the ~20
    // call sites — an archived student (see Student.archived) must never
    // receive another notification, on any channel, through any template,
    // now or in the future. No DB audit log row for this: nothing was
    // actually attempted, so there's nothing a SENT/FAILED log entry
    // would mean.
    if (await this.isArchivedRecipient(target)) {
      this.logger.log(`Skipped "${key}" — recipient is an archived student`);
      return;
    }
    let template: {
      key: string;
      active: boolean;
      smsBody: string | null;
      emailSubject: string | null;
      emailBody: string | null;
    } | null;
    try {
      template = await this.prisma.messageTemplate.findUnique({ where: { key } });
    } catch (err) {
      this.logger.error(`Failed to load template "${key}": ${String(err)}`);
      return;
    }
    if (!template || !template.active) return;

    if (template.emailBody && target.email) {
      await this.sendEmail(
        key,
        target.email,
        this.render(template.emailSubject ?? '', vars),
        this.render(template.emailBody, vars),
      );
    }
    if (template.smsBody && target.phone) {
      await this.sendSms(key, target.phone, this.render(template.smsBody, vars));
    }
  }

  /** Ad-hoc send — bypasses the MessageTemplate registry entirely, for a
   * one-off admin-composed email (see the Mass Email broadcast feature:
   * api/src/admin/broadcasts/). subject/htmlBody get the same
   * {Placeholder} substitution as every lifecycle template. Unlike
   * dispatch(), the caller here needs to know whether the send actually
   * succeeded (to track a broadcast recipient's Sent/Failed status), not
   * just fire-and-forget into an event — so this returns a boolean.
   * logKey is a free-text label for the MessageLog row only (there's no
   * real MessageTemplate behind it), conventionally `BROADCAST:<code>`. */
  async dispatchCustom(
    logKey: string,
    target: DispatchTarget,
    subject: string,
    htmlBody: string,
    vars: TemplateVars = {},
  ): Promise<boolean> {
    if (!target.email) return false;
    if (await this.isArchivedRecipient(target)) {
      this.logger.log(`Skipped "${logKey}" — recipient is an archived student`);
      return false;
    }
    return this.sendEmail(logKey, target.email, this.render(subject, vars), this.render(htmlBody, vars));
  }

  private async isArchivedRecipient(target: DispatchTarget): Promise<boolean> {
    const conditions: { email?: string; phone?: string }[] = [];
    if (target.email) conditions.push({ email: target.email });
    if (target.phone) conditions.push({ phone: target.phone });
    if (!conditions.length) return false;
    const match = await this.prisma.student.findFirst({
      where: { archived: true, OR: conditions },
      select: { id: true },
    });
    return !!match;
  }

  private async sendEmail(templateKey: string, to: string, subject: string, content: string): Promise<boolean> {
    const apiKey = process.env.EMAIL_API_KEY;
    const apiUrl = process.env.EMAIL_API_URL;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !apiUrl || !from) {
      await this.log(templateKey, 'EMAIL', to, 'SKIPPED', null, 'EMAIL_API_KEY/EMAIL_API_URL/EMAIL_FROM not configured');
      return false;
    }
    const body = new URLSearchParams({
      api_key: apiKey,
      subject,
      fromname: 'India Mind League',
      from,
      recipients: to,
      content,
    });
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const text = await res.text();
      let ok = res.ok;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        ok = ok && parsed.message === 'SUCCESS';
      } catch {
        // Non-JSON response — fall back to HTTP status only.
      }
      await this.log(templateKey, 'EMAIL', to, ok ? 'SENT' : 'FAILED', text, ok ? null : `HTTP ${res.status}`);
      return ok;
    } catch (err) {
      await this.log(templateKey, 'EMAIL', to, 'FAILED', null, String(err));
      return false;
    }
  }

  private async sendSms(templateKey: string, to: string, message: string): Promise<void> {
    const apiKey = process.env.SMS_API_KEY;
    const apiUrl = process.env.SMS_API_URL;
    const senderId = process.env.SMS_SENDER_ID;
    if (!apiKey || !apiUrl || !senderId) {
      await this.log(templateKey, 'SMS', to, 'SKIPPED', null, 'SMS_API_KEY/SMS_API_URL/SMS_SENDER_ID not configured');
      return;
    }
    const body = new URLSearchParams({
      api_key: apiKey,
      method: 'sms',
      sender: senderId,
      to,
      message,
    });
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const text = await res.text();
      // ConnectExpress has no public docs confirming their success/failure
      // JSON shape, so we only trust the HTTP-level result here and store
      // the full raw body for an admin to read in the log.
      const ok = res.ok;
      await this.log(templateKey, 'SMS', to, ok ? 'SENT' : 'FAILED', text, ok ? null : `HTTP ${res.status}`);
    } catch (err) {
      await this.log(templateKey, 'SMS', to, 'FAILED', null, String(err));
    }
  }

  private async log(
    templateKey: string,
    channel: 'EMAIL' | 'SMS',
    recipient: string,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    providerResponse: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.prisma.messageLog.create({
        data: { templateKey, channel, recipient, status, providerResponse, errorMessage },
      });
    } catch (err) {
      this.logger.error(`Failed to write message log for "${templateKey}": ${String(err)}`);
    }
  }
}

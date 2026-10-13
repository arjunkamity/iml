import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { DatabaseService } from '../database/database.service';

export interface CertificateData {
  CertificateId: number;
  CertificateNo: string;
  CertType: string;
  IssuedAt: Date;
  UserId: string;
  FullName: string;
  SchoolId: number;
  SchoolName: string;
  QuizTitle: string;
  Score: number | null;
  AccuracyPct: number | null;
}

@Injectable()
export class CertificatesService {
  constructor(private readonly db: DatabaseService) {}

  private certNo(quizId: number, userId: number): string {
    return `IML-${quizId}-${String(userId).padStart(5, '0')}`;
  }

  /** Issue a participation certificate for a student who completed a quiz. */
  async issue(userId: number, quizId: number) {
    const attempt = await this.db.queryOne<{ Status: string }>(
      `SELECT TOP 1 Status FROM dbo.Attempts
        WHERE QuizId = @q AND UserId = @u AND Status IN (N'Submitted', N'AutoSubmitted')`,
      { q: quizId, u: userId },
    );
    if (!attempt) {
      throw new BadRequestException('Complete the quiz before requesting a certificate');
    }
    await this.db.query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.Certificates WHERE UserId = @u AND QuizId = @q)
         INSERT INTO dbo.Certificates (UserId, QuizId, CertificateNo, CertType)
         VALUES (@u, @q, @no, N'Participation')`,
      { u: userId, q: quizId, no: this.certNo(quizId, userId) },
    );
    return this.listForStudent(userId, quizId);
  }

  async listForStudent(userId: number, quizId?: number) {
    return this.db.query(
      `SELECT c.CertificateId, c.CertificateNo, c.CertType, c.IssuedAt, c.QuizId,
              q.Title AS QuizTitle
         FROM dbo.Certificates c
         JOIN dbo.Quizzes q ON q.QuizId = c.QuizId
        WHERE c.UserId = @u AND (@q IS NULL OR c.QuizId = @q)
        ORDER BY c.IssuedAt DESC`,
      { u: userId, q: quizId ?? null },
    );
  }

  /** Admin: issue certificates for everyone who completed a quiz. */
  async generateForQuiz(quizId: number) {
    const res = await this.db.query<{ Created: number }>(
      `INSERT INTO dbo.Certificates (UserId, QuizId, CertificateNo, CertType)
       SELECT a.UserId, a.QuizId,
              CONCAT('IML-', a.QuizId, '-', RIGHT('00000' + CAST(a.UserId AS VARCHAR(10)), 5)),
              N'Participation'
         FROM dbo.Attempts a
        WHERE a.QuizId = @q AND a.Status IN (N'Submitted', N'AutoSubmitted')
          AND NOT EXISTS (SELECT 1 FROM dbo.Certificates c WHERE c.UserId = a.UserId AND c.QuizId = a.QuizId);
       SELECT @@ROWCOUNT AS Created;`,
      { q: quizId },
    );
    return { quizId, created: res[0]?.Created ?? 0 };
  }

  async getForDownload(certificateId: number): Promise<CertificateData> {
    const row = await this.db.queryOne<CertificateData>(
      `SELECT c.CertificateId, c.CertificateNo, c.CertType, c.IssuedAt,
              u.UserId, u.FullName, u.SchoolId, s.Name AS SchoolName,
              q.Title AS QuizTitle, a.Score, a.AccuracyPct
         FROM dbo.Certificates c
         JOIN dbo.Users u    ON u.UserId = c.UserId
         JOIN dbo.Schools s  ON s.SchoolId = u.SchoolId
         JOIN dbo.Quizzes q  ON q.QuizId = c.QuizId
         LEFT JOIN dbo.Attempts a ON a.UserId = c.UserId AND a.QuizId = c.QuizId
        WHERE c.CertificateId = @id`,
      { id: certificateId },
    );
    if (!row) throw new NotFoundException('Certificate not found');
    return row;
  }

  /** Render a participation certificate as a PDF buffer. */
  renderPdf(data: CertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const navy = '#1b1f3b';
      const accent = '#7c3aed';

      doc.rect(0, 0, W, H).fill('#ffffff');
      doc.lineWidth(6).strokeColor(navy).rect(24, 24, W - 48, H - 48).stroke();
      doc.lineWidth(1).strokeColor(accent).rect(36, 36, W - 72, H - 72).stroke();

      doc.fillColor(accent).fontSize(16).text('INDIA MIND LEAGUE', 0, 80, {
        align: 'center',
        characterSpacing: 4,
      });
      doc.fillColor(navy).fontSize(40).text('Certificate of Participation', 0, 120, {
        align: 'center',
      });

      doc.fillColor('#444').fontSize(14).text('This certificate is proudly presented to', 0, 195, {
        align: 'center',
      });
      doc.fillColor(navy).fontSize(34).text(data.FullName, 0, 225, { align: 'center' });

      const detail =
        `for participating in "${data.QuizTitle}"` +
        (data.SchoolName ? `, ${data.SchoolName}` : '') +
        (data.Score != null ? `   |   Score: ${data.Score}` : '');
      doc.fillColor('#444').fontSize(14).text(detail, 0, 285, { align: 'center' });

      const issued = new Date(data.IssuedAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.fontSize(11).fillColor('#666').text(`Certificate No: ${data.CertificateNo}`, 60, H - 90);
      doc.text(`Issued: ${issued}`, 0, H - 90, { align: 'right', width: W - 60 });
      doc.fillColor(accent).fontSize(12).text('Amity Group of Schools', 0, H - 130, {
        align: 'center',
      });

      doc.end();
    });
  }
}

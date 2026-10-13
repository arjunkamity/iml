import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

interface QuizRow {
  QuizId: number;
  QuizType: string;
  DurationSeconds: number;
  TotalQuestions: number;
  IsRandomized: boolean;
  MaxAttempts: number;
  MarkPerCorrect: number;
  MarkPerWrong: number;
  WindowStart: Date | null;
  WindowEnd: Date | null;
  Status: string;
}

interface AttemptRow {
  AttemptId: number;
  QuizId: number;
  UserId: string;
  Status: string;
  StartedAt: Date;
  ServerDeadline: Date;
}

@Injectable()
export class AttemptsService {
  constructor(private readonly db: DatabaseService) {}

  private deadlineFor(now: Date, quiz: QuizRow): Date {
    let dl = new Date(now.getTime() + quiz.DurationSeconds * 1000);
    if (quiz.WindowEnd && new Date(quiz.WindowEnd) < dl) dl = new Date(quiz.WindowEnd);
    return dl;
  }

  private async loadQuiz(quizId: number): Promise<QuizRow> {
    const quiz = await this.db.queryOne<QuizRow>(
      `SELECT QuizId, QuizType, DurationSeconds, TotalQuestions, IsRandomized, MaxAttempts,
              MarkPerCorrect, MarkPerWrong, WindowStart, WindowEnd, Status
         FROM dbo.Quizzes WHERE QuizId = @id`,
      { id: quizId },
    );
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  /** Assign a (possibly randomized) question set to an attempt, in order. */
  private async assignQuestions(
    tx: sql.Transaction,
    attemptId: number,
    quiz: QuizRow,
  ) {
    const pool = await new this.db.sql.Request(tx)
      .input('q', quiz.QuizId)
      .query<{ QuestionId: number }>(
        `SELECT QuestionId FROM dbo.QuizQuestions WHERE QuizId = @q ORDER BY DisplayOrder`,
      );
    let ids = pool.recordset.map((r) => r.QuestionId);
    if (quiz.IsRandomized) {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    }
    ids = ids.slice(0, quiz.TotalQuestions);

    let order = 1;
    for (const qid of ids) {
      await new this.db.sql.Request(tx)
        .input('a', attemptId)
        .input('qid', qid)
        .input('o', order++)
        .query(
          `INSERT INTO dbo.AttemptQuestions (AttemptId, QuestionId, DisplayOrder)
           VALUES (@a, @qid, @o)`,
        );
    }
  }

  /** Start a new attempt or resume an in-progress one. */
  async startOrResume(userId: number, quizId: number) {
    const quiz = await this.loadQuiz(quizId);
    if (quiz.Status !== 'Published') {
      throw new BadRequestException('Quiz is not available');
    }
    const now = new Date();
    if (quiz.WindowStart && now < new Date(quiz.WindowStart)) {
      throw new BadRequestException('Quiz has not opened yet');
    }
    if (quiz.WindowEnd && now > new Date(quiz.WindowEnd)) {
      throw new BadRequestException('Quiz window has closed');
    }

    const existing = await this.db.queryOne<AttemptRow>(
      `SELECT AttemptId, QuizId, UserId, Status, StartedAt, ServerDeadline
         FROM dbo.Attempts WHERE QuizId = @q AND UserId = @u`,
      { q: quizId, u: userId },
    );

    if (existing) {
      if (existing.Status === 'InProgress') {
        if (new Date(existing.ServerDeadline) > now) {
          return this.getState(existing.AttemptId, userId); // resume
        }
        await this.finalize(existing.AttemptId, 'AutoSubmitted'); // expired
      }
      // Attempt already completed:
      if (quiz.MaxAttempts > 1) {
        await this.resetAttempt(existing.AttemptId, quiz, now); // practice/mock retake
        return this.getState(existing.AttemptId, userId);
      }
      throw new ConflictException('You have already attempted this quiz');
    }

    // Fresh attempt
    const deadline = this.deadlineFor(now, quiz);
    const attemptId = await this.db.transaction(async (tx) => {
      const ins = await new this.db.sql.Request(tx)
        .input('q', quizId)
        .input('u', userId)
        .input('deadline', deadline)
        .query<{ AttemptId: number }>(
          `INSERT INTO dbo.Attempts (QuizId, UserId, Status, ServerDeadline)
           OUTPUT INSERTED.AttemptId
           VALUES (@q, @u, N'InProgress', @deadline)`,
        );
      const id = ins.recordset[0].AttemptId;
      await this.assignQuestions(tx, id, quiz);
      return id;
    });
    return this.getState(attemptId, userId);
  }

  private async resetAttempt(attemptId: number, quiz: QuizRow, now: Date) {
    const deadline = this.deadlineFor(now, quiz);
    await this.db.transaction(async (tx) => {
      await new this.db.sql.Request(tx)
        .input('a', attemptId)
        .query(`DELETE FROM dbo.Answers WHERE AttemptId = @a`);
      await new this.db.sql.Request(tx)
        .input('a', attemptId)
        .query(`DELETE FROM dbo.AttemptQuestions WHERE AttemptId = @a`);
      await new this.db.sql.Request(tx)
        .input('a', attemptId)
        .input('deadline', deadline)
        .query(
          `UPDATE dbo.Attempts
              SET Status = N'InProgress', StartedAt = SYSUTCDATETIME(), ServerDeadline = @deadline,
                  SubmittedAt = NULL, Score = NULL, CorrectCount = NULL, WrongCount = NULL,
                  UnansweredCount = NULL, AccuracyPct = NULL, DurationTakenSeconds = NULL,
                  UpdatedAt = SYSUTCDATETIME()
            WHERE AttemptId = @a`,
        );
      await this.assignQuestions(tx, attemptId, quiz);
    });
  }

  private async ownedAttempt(attemptId: number, userId: number): Promise<AttemptRow> {
    const a = await this.db.queryOne<AttemptRow>(
      `SELECT AttemptId, QuizId, UserId, Status, StartedAt, ServerDeadline
         FROM dbo.Attempts WHERE AttemptId = @a`,
      { a: attemptId },
    );
    if (!a) throw new NotFoundException('Attempt not found');
    if (Number(a.UserId) !== userId) {
      throw new ForbiddenException('Not your attempt');
    }
    return a;
  }

  /** Current attempt view: in-progress state (questions+answers) or final result. */
  async getState(attemptId: number, userId: number) {
    let attempt = await this.ownedAttempt(attemptId, userId);

    if (attempt.Status === 'InProgress' && new Date(attempt.ServerDeadline) <= new Date()) {
      await this.finalize(attemptId, 'AutoSubmitted');
      attempt = await this.ownedAttempt(attemptId, userId);
    }

    if (attempt.Status !== 'InProgress') {
      return { status: attempt.Status, result: await this.result(attemptId) };
    }

    const questions = await this.db.query<{
      DisplayOrder: number;
      QuestionId: string;
      QuestionText: string;
      Category: string;
    }>(
      `SELECT aq.DisplayOrder, q.QuestionId, q.QuestionText, c.Code AS Category
         FROM dbo.AttemptQuestions aq
         JOIN dbo.Questions q ON q.QuestionId = aq.QuestionId
         JOIN dbo.Categories c ON c.CategoryId = q.CategoryId
        WHERE aq.AttemptId = @a
        ORDER BY aq.DisplayOrder`,
      { a: attemptId },
    );
    // Options WITHOUT IsCorrect (never leak answers to the client).
    const options = await this.db.query<{
      QuestionId: string;
      OptionId: string;
      OptionText: string;
      OptionOrder: number;
    }>(
      `SELECT o.QuestionId, o.OptionId, o.OptionText, o.OptionOrder
         FROM dbo.QuestionOptions o
         JOIN dbo.AttemptQuestions aq ON aq.QuestionId = o.QuestionId AND aq.AttemptId = @a
        ORDER BY o.QuestionId, o.OptionOrder`,
      { a: attemptId },
    );
    const answers = await this.db.query<{ QuestionId: string; SelectedOptionId: string }>(
      `SELECT QuestionId, SelectedOptionId FROM dbo.Answers WHERE AttemptId = @a`,
      { a: attemptId },
    );
    const answerMap = new Map(answers.map((r) => [String(r.QuestionId), r.SelectedOptionId]));

    const secondsRemaining = Math.max(
      0,
      Math.floor((new Date(attempt.ServerDeadline).getTime() - Date.now()) / 1000),
    );

    return {
      status: 'InProgress',
      attemptId,
      quizId: attempt.QuizId,
      secondsRemaining,
      questions: questions.map((q) => ({
        questionId: q.QuestionId,
        order: q.DisplayOrder,
        category: q.Category,
        text: q.QuestionText,
        selectedOptionId: answerMap.get(String(q.QuestionId)) ?? null,
        options: options
          .filter((o) => String(o.QuestionId) === String(q.QuestionId))
          .map((o) => ({ optionId: o.OptionId, text: o.OptionText, order: o.OptionOrder })),
      })),
    };
  }

  /** Auto-save a single answer (idempotent upsert). */
  async saveAnswer(
    userId: number,
    attemptId: number,
    questionId: number,
    optionId: number,
  ) {
    const attempt = await this.ownedAttempt(attemptId, userId);
    if (attempt.Status !== 'InProgress') {
      throw new BadRequestException('Attempt is not in progress');
    }
    if (new Date(attempt.ServerDeadline) <= new Date()) {
      await this.finalize(attemptId, 'AutoSubmitted');
      throw new BadRequestException('Time is up; the quiz was auto-submitted');
    }

    const valid = await this.db.queryOne<{ ok: number }>(
      `SELECT 1 AS ok
         FROM dbo.AttemptQuestions aq
         JOIN dbo.QuestionOptions o ON o.QuestionId = aq.QuestionId
        WHERE aq.AttemptId = @a AND aq.QuestionId = @q AND o.OptionId = @o`,
      { a: attemptId, q: questionId, o: optionId },
    );
    if (!valid) {
      throw new BadRequestException('Invalid question or option for this attempt');
    }

    await this.db.query(
      `MERGE dbo.Answers AS t
       USING (SELECT @a AS AttemptId, @q AS QuestionId) AS s
         ON t.AttemptId = s.AttemptId AND t.QuestionId = s.QuestionId
       WHEN MATCHED THEN
         UPDATE SET SelectedOptionId = @o, AnsweredAt = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (AttemptId, QuestionId, SelectedOptionId) VALUES (@a, @q, @o);`,
      { a: attemptId, q: questionId, o: optionId },
    );
    return { saved: true };
  }

  /** Submit (or auto-submit) and score the attempt. Idempotent. */
  async submit(userId: number, attemptId: number) {
    const attempt = await this.ownedAttempt(attemptId, userId);
    if (attempt.Status !== 'InProgress') {
      return { status: attempt.Status, result: await this.result(attemptId) };
    }
    await this.finalize(attemptId, 'Submitted');
    return { status: 'Submitted', result: await this.result(attemptId) };
  }

  /** Compute and persist the score. Status: 'Submitted' or 'AutoSubmitted'. */
  private async finalize(attemptId: number, status: 'Submitted' | 'AutoSubmitted') {
    const quiz = await this.db.queryOne<{ MarkPerCorrect: number; MarkPerWrong: number }>(
      `SELECT q.MarkPerCorrect, q.MarkPerWrong
         FROM dbo.Quizzes q JOIN dbo.Attempts a ON a.QuizId = q.QuizId
        WHERE a.AttemptId = @a`,
      { a: attemptId },
    );
    if (!quiz) throw new NotFoundException('Attempt/quiz not found');

    // Mark each answer correct/incorrect for the record.
    await this.db.query(
      `UPDATE ans
          SET IsCorrect = CASE WHEN o.IsCorrect = 1 THEN 1 ELSE 0 END
         FROM dbo.Answers ans
         JOIN dbo.QuestionOptions o ON o.OptionId = ans.SelectedOptionId
        WHERE ans.AttemptId = @a`,
      { a: attemptId },
    );

    const tally = await this.db.queryOne<{
      Total: number;
      Correct: number;
      Wrong: number;
      Unanswered: number;
    }>(
      `;WITH ans AS (
         SELECT aq.QuestionId, a.SelectedOptionId,
                (SELECT TOP 1 OptionId FROM dbo.QuestionOptions o
                  WHERE o.QuestionId = aq.QuestionId AND o.IsCorrect = 1) AS CorrectOptionId
           FROM dbo.AttemptQuestions aq
           LEFT JOIN dbo.Answers a ON a.AttemptId = aq.AttemptId AND a.QuestionId = aq.QuestionId
          WHERE aq.AttemptId = @a
       )
       SELECT COUNT(*) AS Total,
              SUM(CASE WHEN SelectedOptionId IS NOT NULL AND SelectedOptionId = CorrectOptionId THEN 1 ELSE 0 END) AS Correct,
              SUM(CASE WHEN SelectedOptionId IS NOT NULL AND SelectedOptionId <> CorrectOptionId THEN 1 ELSE 0 END) AS Wrong,
              SUM(CASE WHEN SelectedOptionId IS NULL THEN 1 ELSE 0 END) AS Unanswered
         FROM ans`,
      { a: attemptId },
    );

    const total = tally?.Total ?? 0;
    const correct = tally?.Correct ?? 0;
    const wrong = tally?.Wrong ?? 0;
    const unanswered = tally?.Unanswered ?? 0;
    const score = correct * quiz.MarkPerCorrect - wrong * quiz.MarkPerWrong;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    await this.db.query(
      `UPDATE dbo.Attempts
          SET Status = @status, SubmittedAt = SYSUTCDATETIME(),
              Score = @score, CorrectCount = @correct, WrongCount = @wrong,
              UnansweredCount = @unanswered, AccuracyPct = @accuracy,
              DurationTakenSeconds = DATEDIFF(second, StartedAt, SYSUTCDATETIME()),
              UpdatedAt = SYSUTCDATETIME()
        WHERE AttemptId = @a`,
      {
        a: attemptId,
        status,
        score,
        correct,
        wrong,
        unanswered,
        accuracy: Math.round(accuracy * 100) / 100,
      },
    );
  }

  private async result(attemptId: number) {
    return this.db.queryOne(
      `SELECT AttemptId, QuizId, Status, Score, CorrectCount, WrongCount, UnansweredCount,
              AccuracyPct, DurationTakenSeconds, SubmittedAt
         FROM dbo.Attempts WHERE AttemptId = @a`,
      { a: attemptId },
    );
  }
}

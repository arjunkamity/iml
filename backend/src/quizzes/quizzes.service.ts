import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';

@Injectable()
export class QuizzesService {
  constructor(private readonly db: DatabaseService) {}

  // ---- Admin: quizzes ----------------------------------------------------

  async createQuiz(dto: CreateQuizDto) {
    const row = await this.db.queryOne<{ QuizId: number }>(
      `INSERT INTO dbo.Quizzes
         (Title, QuizType, DurationSeconds, TotalQuestions, MarkPerCorrect, MarkPerWrong,
          IsRandomized, MaxAttempts, WindowStart, WindowEnd, Status)
       OUTPUT INSERTED.QuizId
       VALUES (@title, @quizType, @durationSeconds, @totalQuestions,
               @markPerCorrect, @markPerWrong, @isRandomized, @maxAttempts,
               @windowStart, @windowEnd, N'Draft')`,
      {
        title: dto.title,
        quizType: dto.quizType,
        durationSeconds: dto.durationSeconds,
        totalQuestions: dto.totalQuestions,
        markPerCorrect: dto.markPerCorrect ?? 1,
        markPerWrong: dto.markPerWrong ?? 0,
        isRandomized: dto.isRandomized ?? true,
        maxAttempts: dto.maxAttempts ?? (dto.quizType === 'Qualifier' ? 1 : 99),
        windowStart: dto.windowStart ? new Date(dto.windowStart) : null,
        windowEnd: dto.windowEnd ? new Date(dto.windowEnd) : null,
      },
    );
    return { quizId: row!.QuizId };
  }

  async listQuizzes() {
    return this.db.query(
      `SELECT q.QuizId, q.Title, q.QuizType, q.DurationSeconds, q.TotalQuestions,
              q.MaxAttempts, q.IsRandomized, q.WindowStart, q.WindowEnd, q.Status, q.CreatedAt,
              (SELECT COUNT(*) FROM dbo.QuizQuestions qq WHERE qq.QuizId = q.QuizId) AS PoolSize
         FROM dbo.Quizzes q
        ORDER BY q.CreatedAt DESC`,
    );
  }

  async publishQuiz(quizId: number) {
    const quiz = await this.db.queryOne<{ TotalQuestions: number; PoolSize: number }>(
      `SELECT q.TotalQuestions,
              (SELECT COUNT(*) FROM dbo.QuizQuestions qq WHERE qq.QuizId = q.QuizId) AS PoolSize
         FROM dbo.Quizzes q WHERE q.QuizId = @id`,
      { id: quizId },
    );
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.PoolSize < quiz.TotalQuestions) {
      throw new BadRequestException(
        `Question pool (${quiz.PoolSize}) is smaller than TotalQuestions (${quiz.TotalQuestions})`,
      );
    }
    await this.db.query(
      `UPDATE dbo.Quizzes SET Status = N'Published', UpdatedAt = SYSUTCDATETIME() WHERE QuizId = @id`,
      { id: quizId },
    );
    return { quizId, status: 'Published' };
  }

  async attachQuestions(quizId: number, questionIds: number[]) {
    const quiz = await this.db.queryOne<{ QuizId: number }>(
      `SELECT QuizId FROM dbo.Quizzes WHERE QuizId = @id`,
      { id: quizId },
    );
    if (!quiz) throw new NotFoundException('Quiz not found');

    await this.db.transaction(async (tx) => {
      for (const qid of questionIds) {
        await new this.db.sql.Request(tx)
          .input('q', quizId)
          .input('qid', qid)
          .query(
            `INSERT INTO dbo.QuizQuestions (QuizId, QuestionId, DisplayOrder)
             SELECT @q, @qid, ISNULL((SELECT MAX(DisplayOrder) FROM dbo.QuizQuestions WHERE QuizId = @q), 0) + 1
             WHERE NOT EXISTS (SELECT 1 FROM dbo.QuizQuestions WHERE QuizId = @q AND QuestionId = @qid)`,
          );
      }
    });
    return { quizId, attached: questionIds.length };
  }

  // ---- Admin: questions --------------------------------------------------

  async createQuestion(dto: CreateQuestionDto) {
    if (!dto.options.some((o) => o.isCorrect)) {
      throw new BadRequestException('At least one option must be correct');
    }
    const cat = await this.db.queryOne<{ CategoryId: number }>(
      `SELECT CategoryId FROM dbo.Categories WHERE Code = @code`,
      { code: dto.categoryCode },
    );
    if (!cat) throw new BadRequestException('Unknown category code');

    return this.db.transaction(async (tx) => {
      const q = await new this.db.sql.Request(tx)
        .input('categoryId', cat.CategoryId)
        .input('text', dto.questionText)
        .input('difficulty', dto.difficulty ?? 'Medium')
        .input('marks', dto.marks ?? 1)
        .query<{ QuestionId: number }>(
          `INSERT INTO dbo.Questions (CategoryId, QuestionText, Difficulty, Marks)
           OUTPUT INSERTED.QuestionId
           VALUES (@categoryId, @text, @difficulty, @marks)`,
        );
      const questionId = q.recordset[0].QuestionId;

      let order = 1;
      for (const opt of dto.options) {
        await new this.db.sql.Request(tx)
          .input('qid', questionId)
          .input('text', opt.text)
          .input('correct', opt.isCorrect)
          .input('order', opt.order ?? order++)
          .query(
            `INSERT INTO dbo.QuestionOptions (QuestionId, OptionText, IsCorrect, OptionOrder)
             VALUES (@qid, @text, @correct, @order)`,
          );
      }
      return { questionId };
    });
  }

  async listQuestions() {
    return this.db.query(
      `SELECT q.QuestionId, c.Code AS Category, q.QuestionText, q.Difficulty, q.Marks, q.Status,
              (SELECT COUNT(*) FROM dbo.QuestionOptions o WHERE o.QuestionId = q.QuestionId) AS Options
         FROM dbo.Questions q
         JOIN dbo.Categories c ON c.CategoryId = q.CategoryId
        ORDER BY q.QuestionId DESC`,
    );
  }

  // ---- Student: available quizzes ---------------------------------------

  async listAvailableForStudent(userId: number) {
    return this.db.query(
      `SELECT q.QuizId, q.Title, q.QuizType, q.DurationSeconds, q.TotalQuestions,
              q.MaxAttempts, q.WindowStart, q.WindowEnd,
              a.Status AS AttemptStatus, a.Score, a.SubmittedAt
         FROM dbo.Quizzes q
         LEFT JOIN dbo.Attempts a ON a.QuizId = q.QuizId AND a.UserId = @u
        WHERE q.Status = N'Published'
        ORDER BY CASE q.QuizType WHEN 'Practice' THEN 0 WHEN 'Mock' THEN 1 ELSE 2 END, q.CreatedAt DESC`,
      { u: userId },
    );
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { JwtPayload } from '../auth/auth.types';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  /** Admin landing dashboard totals. */
  async overview() {
    return this.db.queryOne(
      `SELECT
         (SELECT COUNT(*) FROM dbo.Schools)                                              AS Schools,
         (SELECT COUNT(*) FROM dbo.Schools WHERE Status = N'Active')                      AS ActiveSchools,
         (SELECT COUNT(*) FROM dbo.Users WHERE RoleId = 3)                                AS Students,
         (SELECT COUNT(*) FROM dbo.Quizzes WHERE Status = N'Published')                   AS PublishedQuizzes,
         (SELECT COUNT(*) FROM dbo.Attempts WHERE Status IN (N'Submitted',N'AutoSubmitted')) AS CompletedAttempts,
         (SELECT COUNT(*) FROM dbo.Attempts WHERE Status = N'InProgress')                 AS InProgressAttempts`,
    );
  }

  /** School-wise participation + performance (admin). */
  async schoolParticipation() {
    return this.db.query(
      `SELECT * FROM dbo.vw_SchoolParticipation ORDER BY SchoolName`,
    );
  }

  /** Per-student results for a quiz; coordinator is scoped to own school. */
  async quizResults(user: JwtPayload, quizId: number) {
    const schoolId = user.role === 'COORDINATOR' ? user.schoolId : null;
    return this.db.query(
      `SELECT u.UserId, u.FullName, s.SchoolCode, s.Name AS SchoolName,
              a.Score, a.AccuracyPct, a.CorrectCount, a.WrongCount, a.UnansweredCount,
              a.DurationTakenSeconds, a.Status, a.SubmittedAt
         FROM dbo.Attempts a
         JOIN dbo.Users u   ON u.UserId = a.UserId
         JOIN dbo.Schools s ON s.SchoolId = u.SchoolId
        WHERE a.QuizId = @q
          AND a.Status IN (N'Submitted', N'AutoSubmitted')
          AND (@schoolId IS NULL OR u.SchoolId = @schoolId)
        ORDER BY a.Score DESC, a.DurationTakenSeconds ASC`,
      { q: quizId, schoolId },
    );
  }

  /** Shortlisted candidates: top N by rank (admin). */
  async shortlist(quizId: number, top: number) {
    return this.db.query(
      `SELECT TOP (@top) Rnk, UserId, FullName, SchoolName, Score, AccuracyPct,
              CorrectCount, DurationTakenSeconds, SubmittedAt
         FROM dbo.vw_QualifierLeaderboard
        WHERE QuizId = @q
        ORDER BY Rnk`,
      { q: quizId, top },
    );
  }

  /** Public live leaderboard: top N for a quiz. */
  async leaderboard(quizId: number, top: number) {
    return this.db.query(
      `SELECT TOP (@top) Rnk, FullName, SchoolName, Score, AccuracyPct
         FROM dbo.vw_QualifierLeaderboard
        WHERE QuizId = @q
        ORDER BY Rnk`,
      { q: quizId, top },
    );
  }
}

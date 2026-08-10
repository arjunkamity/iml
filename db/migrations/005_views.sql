/* =====================================================================
   India Mind League - 005 Reporting Views
   Leaderboard (with tie-break) and school participation summary.
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* Qualifier leaderboard with tie-break logic:
   higher Score first, then faster completion, then earlier submission. */
CREATE OR ALTER VIEW dbo.vw_QualifierLeaderboard
AS
SELECT
    a.QuizId,
    a.UserId,
    u.FullName,
    s.SchoolId,
    s.Name                AS SchoolName,
    a.Score,
    a.AccuracyPct,
    a.CorrectCount,
    a.DurationTakenSeconds,
    a.SubmittedAt,
    RANK() OVER (
        PARTITION BY a.QuizId
        ORDER BY a.Score DESC, a.DurationTakenSeconds ASC, a.SubmittedAt ASC
    ) AS Rnk
FROM dbo.Attempts a
JOIN dbo.Users u        ON u.UserId  = a.UserId
LEFT JOIN dbo.Schools s ON s.SchoolId = u.SchoolId
WHERE a.Status IN (N'Submitted', N'AutoSubmitted');
GO

/* School-wise participation + performance summary (for Admin & Coordinator dashboards). */
CREATE OR ALTER VIEW dbo.vw_SchoolParticipation
AS
SELECT
    sc.SchoolId,
    sc.SchoolCode,
    sc.Name                    AS SchoolName,
    a.QuizId,
    COUNT(DISTINCT u.UserId)   AS RegisteredStudents,
    COUNT(DISTINCT a.UserId)   AS Attempted,
    AVG(a.Score)               AS AvgScore,
    MAX(a.Score)               AS TopScore
FROM dbo.Schools sc
LEFT JOIN dbo.Users u    ON u.SchoolId = sc.SchoolId AND u.RoleId = 3
LEFT JOIN dbo.Attempts a ON a.UserId = u.UserId AND a.Status IN (N'Submitted', N'AutoSubmitted')
GROUP BY sc.SchoolId, sc.SchoolCode, sc.Name, a.QuizId;
GO

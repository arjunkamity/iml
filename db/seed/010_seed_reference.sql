/* =====================================================================
   India Mind League - 010 Reference & Sample Seed
   Roles, categories, one sample school, an admin user, and a small
   practice quiz so the schema can be exercised end-to-end. Idempotent.
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* Roles */
MERGE dbo.Roles AS t
USING (VALUES (1, N'ADMIN',       N'Administrator'),
              (2, N'COORDINATOR', N'School Coordinator'),
              (3, N'STUDENT',     N'Participant')) AS s(RoleId, Code, Name)
ON t.RoleId = s.RoleId
WHEN NOT MATCHED THEN INSERT (RoleId, Code, Name) VALUES (s.RoleId, s.Code, s.Name);
GO

/* Categories: IQ / EQ / Core Values */
MERGE dbo.Categories AS t
USING (VALUES (N'IQ',  N'Intelligence Quotient', N'Logical reasoning, problem solving'),
              (N'EQ',  N'Emotional Quotient',    N'Empathy, self-awareness, social skills'),
              (N'VAL', N'Core Values',           N'Ethics, integrity, responsibility')) AS s(Code, Name, Description)
ON t.Code = s.Code
WHEN NOT MATCHED THEN INSERT (Code, Name, Description) VALUES (s.Code, s.Name, s.Description);
GO

/* Sample school */
IF NOT EXISTS (SELECT 1 FROM dbo.Schools WHERE SchoolCode = N'IML-DEL-0001')
    INSERT dbo.Schools (SchoolCode, Name, City, State, Status)
    VALUES (N'IML-DEL-0001', N'Amity International School, Saket', N'New Delhi', N'Delhi', N'Active');
GO

/* Admin user (replace PasswordHash via the app's hashing on first real setup) */
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'admin@indiamindleague.in')
    INSERT dbo.Users (RoleId, FullName, Email, PasswordHash, EmailVerified, Status)
    VALUES (1, N'IML Administrator', N'admin@indiamindleague.in', N'REPLACE_WITH_HASH', 1, N'Active');
GO

/* Sample practice quiz with two questions */
IF NOT EXISTS (SELECT 1 FROM dbo.Quizzes WHERE Title = N'IML Practice Quiz')
BEGIN
    INSERT dbo.Quizzes (Title, QuizType, DurationSeconds, TotalQuestions, IsRandomized, MaxAttempts, Status)
    VALUES (N'IML Practice Quiz', N'Practice', 600, 2, 1, 99, N'Published');

    DECLARE @QuizId INT = SCOPE_IDENTITY();
    DECLARE @IQ INT = (SELECT CategoryId FROM dbo.Categories WHERE Code = N'IQ');
    DECLARE @EQ INT = (SELECT CategoryId FROM dbo.Categories WHERE Code = N'EQ');
    DECLARE @Q1 BIGINT, @Q2 BIGINT;

    INSERT dbo.Questions (CategoryId, QuestionText, Difficulty)
    VALUES (@IQ, N'What comes next in the series: 2, 4, 8, 16, ?', N'Easy');
    SET @Q1 = SCOPE_IDENTITY();
    INSERT dbo.QuestionOptions (QuestionId, OptionText, IsCorrect, OptionOrder) VALUES
        (@Q1, N'24', 0, 1), (@Q1, N'32', 1, 2), (@Q1, N'30', 0, 3), (@Q1, N'18', 0, 4);

    INSERT dbo.Questions (CategoryId, QuestionText, Difficulty)
    VALUES (@EQ, N'A friend is upset after losing a match. The best response is to:', N'Easy');
    SET @Q2 = SCOPE_IDENTITY();
    INSERT dbo.QuestionOptions (QuestionId, OptionText, IsCorrect, OptionOrder) VALUES
        (@Q2, N'Ignore them', 0, 1),
        (@Q2, N'Listen and offer support', 1, 2),
        (@Q2, N'Tell them they played badly', 0, 3),
        (@Q2, N'Change the subject', 0, 4);

    INSERT dbo.QuizQuestions (QuizId, QuestionId, DisplayOrder)
    VALUES (@QuizId, @Q1, 1), (@QuizId, @Q2, 2);
END
GO

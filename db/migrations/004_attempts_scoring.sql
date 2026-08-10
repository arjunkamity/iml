/* =====================================================================
   India Mind League - 004 Attempts & Scoring
   Attempts (one per student/quiz, server-authoritative timer),
   per-attempt question set, answers, and certificates.
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* ---------- Attempts: ONE per student per quiz (enforced by unique key) ---------- */
IF OBJECT_ID(N'dbo.Attempts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Attempts (
        AttemptId            BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        QuizId               INT           NOT NULL,
        UserId               BIGINT        NOT NULL,   -- student
        Status               NVARCHAR(20)  NOT NULL CONSTRAINT DF_Attempts_Status   DEFAULT N'InProgress',
        StartedAt            DATETIME2(3)  NOT NULL CONSTRAINT DF_Attempts_Started   DEFAULT SYSUTCDATETIME(),
        ServerDeadline       DATETIME2(3)  NOT NULL,   -- authoritative; client timer is display only
        SubmittedAt          DATETIME2(3)  NULL,
        Score                DECIMAL(7,2)  NULL,
        CorrectCount         INT           NULL,
        WrongCount           INT           NULL,
        UnansweredCount      INT           NULL,
        AccuracyPct          DECIMAL(5,2)  NULL,
        DurationTakenSeconds INT           NULL,
        IpAddress            NVARCHAR(45)  NULL,
        UserAgent            NVARCHAR(400) NULL,
        CreatedAt            DATETIME2(3)  NOT NULL CONSTRAINT DF_Attempts_Created    DEFAULT SYSUTCDATETIME(),
        UpdatedAt            DATETIME2(3)  NOT NULL CONSTRAINT DF_Attempts_Updated    DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Attempts_Quizzes FOREIGN KEY (QuizId) REFERENCES dbo.Quizzes(QuizId),
        CONSTRAINT FK_Attempts_Users   FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_Attempts_Status  CHECK (Status IN (N'InProgress', N'Submitted', N'AutoSubmitted', N'Expired')),
        CONSTRAINT UQ_Attempts_Quiz_User UNIQUE (QuizId, UserId)   -- one-attempt guarantee
    );
    CREATE INDEX IX_Attempts_Quiz_Score ON dbo.Attempts(QuizId, Score DESC);
END
GO

/* ---------- Per-attempt question set (supports per-student randomization) ---------- */
IF OBJECT_ID(N'dbo.AttemptQuestions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttemptQuestions (
        AttemptId    BIGINT NOT NULL,
        QuestionId   BIGINT NOT NULL,
        DisplayOrder INT    NOT NULL,
        CONSTRAINT PK_AttemptQuestions PRIMARY KEY (AttemptId, QuestionId),
        CONSTRAINT FK_AttemptQuestions_Attempts  FOREIGN KEY (AttemptId)  REFERENCES dbo.Attempts(AttemptId) ON DELETE CASCADE,
        CONSTRAINT FK_AttemptQuestions_Questions FOREIGN KEY (QuestionId) REFERENCES dbo.Questions(QuestionId)
    );
END
GO

/* ---------- Answers (auto-saved; in prod buffered in Redis then flushed here) ---------- */
IF OBJECT_ID(N'dbo.Answers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Answers (
        AnswerId         BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AttemptId        BIGINT       NOT NULL,
        QuestionId       BIGINT       NOT NULL,
        SelectedOptionId BIGINT       NULL,
        IsCorrect        BIT          NULL,        -- set at scoring time
        AnsweredAt       DATETIME2(3) NOT NULL CONSTRAINT DF_Answers_AnsweredAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Answers_Attempts  FOREIGN KEY (AttemptId)        REFERENCES dbo.Attempts(AttemptId) ON DELETE CASCADE,
        CONSTRAINT FK_Answers_Questions FOREIGN KEY (QuestionId)       REFERENCES dbo.Questions(QuestionId),
        CONSTRAINT FK_Answers_Options   FOREIGN KEY (SelectedOptionId) REFERENCES dbo.QuestionOptions(OptionId),
        CONSTRAINT UQ_Answers_Attempt_Question UNIQUE (AttemptId, QuestionId)
    );
END
GO

/* ---------- Certificates ---------- */
IF OBJECT_ID(N'dbo.Certificates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Certificates (
        CertificateId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId        BIGINT        NOT NULL,
        QuizId        INT           NOT NULL,
        CertificateNo NVARCHAR(50)  NOT NULL,
        CertType      NVARCHAR(20)  NOT NULL CONSTRAINT DF_Certificates_Type   DEFAULT N'Participation',
        FileUrl       NVARCHAR(400) NULL,
        IssuedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Certificates_Issued DEFAULT SYSUTCDATETIME(),
        EmailedAt     DATETIME2(3)  NULL,
        CONSTRAINT FK_Certificates_Users   FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Certificates_Quizzes FOREIGN KEY (QuizId) REFERENCES dbo.Quizzes(QuizId),
        CONSTRAINT UQ_Certificates_No        UNIQUE (CertificateNo),
        CONSTRAINT UQ_Certificates_User_Quiz UNIQUE (UserId, QuizId),
        CONSTRAINT CK_Certificates_Type      CHECK (CertType IN (N'Participation', N'Merit'))
    );
END
GO

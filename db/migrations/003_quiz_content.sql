/* =====================================================================
   India Mind League - 003 Quiz Content
   Categories (IQ/EQ/Values), Quizzes, Questions, Options, and the
   quiz->question pool.
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* ---------- Categories: IQ / EQ / Core Values ---------- */
IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categories (
        CategoryId  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Code        NVARCHAR(20)  NOT NULL UNIQUE,
        Name        NVARCHAR(100) NOT NULL,
        Description NVARCHAR(400) NULL
    );
END
GO

/* ---------- Quizzes ---------- */
IF OBJECT_ID(N'dbo.Quizzes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Quizzes (
        QuizId          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Title           NVARCHAR(200) NOT NULL,
        QuizType        NVARCHAR(20)  NOT NULL,   -- Practice / Mock / Qualifier
        DurationSeconds INT           NOT NULL,
        TotalQuestions  INT           NOT NULL,
        MarkPerCorrect  DECIMAL(5,2)  NOT NULL CONSTRAINT DF_Quizzes_MarkCorrect DEFAULT 1,
        MarkPerWrong    DECIMAL(5,2)  NOT NULL CONSTRAINT DF_Quizzes_MarkWrong   DEFAULT 0,
        IsRandomized    BIT           NOT NULL CONSTRAINT DF_Quizzes_Randomized  DEFAULT 1,
        MaxAttempts     INT           NOT NULL CONSTRAINT DF_Quizzes_MaxAttempts DEFAULT 1,
        WindowStart     DATETIME2(3)  NULL,        -- live qualifier open window
        WindowEnd       DATETIME2(3)  NULL,
        Status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_Quizzes_Status      DEFAULT N'Draft',
        CreatedAt       DATETIME2(3)  NOT NULL CONSTRAINT DF_Quizzes_Created     DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(3)  NOT NULL CONSTRAINT DF_Quizzes_Updated     DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Quizzes_Type   CHECK (QuizType IN (N'Practice', N'Mock', N'Qualifier')),
        CONSTRAINT CK_Quizzes_Status CHECK (Status IN (N'Draft', N'Published', N'Closed'))
    );
END
GO

/* ---------- Question bank ---------- */
IF OBJECT_ID(N'dbo.Questions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Questions (
        QuestionId   BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CategoryId   INT           NOT NULL,
        QuestionText NVARCHAR(MAX) NOT NULL,
        QuestionType NVARCHAR(20)  NOT NULL CONSTRAINT DF_Questions_Type       DEFAULT N'SingleChoice',
        Difficulty   NVARCHAR(10)  NOT NULL CONSTRAINT DF_Questions_Difficulty DEFAULT N'Medium',
        Marks        DECIMAL(5,2)  NOT NULL CONSTRAINT DF_Questions_Marks      DEFAULT 1,
        Status       NVARCHAR(20)  NOT NULL CONSTRAINT DF_Questions_Status     DEFAULT N'Active',
        CreatedAt    DATETIME2(3)  NOT NULL CONSTRAINT DF_Questions_Created    DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Questions_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(CategoryId),
        CONSTRAINT CK_Questions_Type       CHECK (QuestionType IN (N'SingleChoice', N'MultiChoice')),
        CONSTRAINT CK_Questions_Difficulty CHECK (Difficulty IN (N'Easy', N'Medium', N'Hard')),
        CONSTRAINT CK_Questions_Status     CHECK (Status IN (N'Active', N'Archived'))
    );
    CREATE INDEX IX_Questions_Category ON dbo.Questions(CategoryId, Status);
END
GO

/* ---------- Question options ---------- */
IF OBJECT_ID(N'dbo.QuestionOptions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.QuestionOptions (
        OptionId    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        QuestionId  BIGINT        NOT NULL,
        OptionText  NVARCHAR(MAX) NOT NULL,
        IsCorrect   BIT           NOT NULL CONSTRAINT DF_QuestionOptions_Correct DEFAULT 0,
        OptionOrder INT           NOT NULL CONSTRAINT DF_QuestionOptions_Order   DEFAULT 1,
        CONSTRAINT FK_QuestionOptions_Questions FOREIGN KEY (QuestionId)
            REFERENCES dbo.Questions(QuestionId) ON DELETE CASCADE
    );
    CREATE INDEX IX_QuestionOptions_Question ON dbo.QuestionOptions(QuestionId);
END
GO

/* ---------- Quiz <-> Question pool ---------- */
IF OBJECT_ID(N'dbo.QuizQuestions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.QuizQuestions (
        QuizId       INT    NOT NULL,
        QuestionId   BIGINT NOT NULL,
        DisplayOrder INT    NOT NULL CONSTRAINT DF_QuizQuestions_Order DEFAULT 1,
        CONSTRAINT PK_QuizQuestions PRIMARY KEY (QuizId, QuestionId),
        CONSTRAINT FK_QuizQuestions_Quizzes   FOREIGN KEY (QuizId)     REFERENCES dbo.Quizzes(QuizId) ON DELETE CASCADE,
        CONSTRAINT FK_QuizQuestions_Questions FOREIGN KEY (QuestionId) REFERENCES dbo.Questions(QuestionId)
    );
END
GO

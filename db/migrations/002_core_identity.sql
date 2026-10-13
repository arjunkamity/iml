/* =====================================================================
   India Mind League - 002 Core Identity
   Roles, Schools, Users (Admin / Coordinator / Student), Student profiles,
   and OTP request log.
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* ---------- Roles ---------- */
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles (
        RoleId  INT          NOT NULL PRIMARY KEY,
        Code    NVARCHAR(20) NOT NULL UNIQUE,
        Name    NVARCHAR(50) NOT NULL
    );
END
GO

/* ---------- Schools ---------- */
IF OBJECT_ID(N'dbo.Schools', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Schools (
        SchoolId      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SchoolCode    NVARCHAR(20)  NOT NULL,
        Name          NVARCHAR(200) NOT NULL,
        City          NVARCHAR(100) NULL,
        State         NVARCHAR(100) NULL,
        Address       NVARCHAR(400) NULL,
        ContactEmail  NVARCHAR(256) NULL,
        ContactPhone  NVARCHAR(20)  NULL,
        Status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_Schools_Status   DEFAULT N'Pending',
        CreatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Schools_Created   DEFAULT SYSUTCDATETIME(),
        UpdatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Schools_Updated   DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Schools_SchoolCode UNIQUE (SchoolCode),
        CONSTRAINT CK_Schools_Status CHECK (Status IN (N'Pending', N'Active', N'Suspended'))
    );
END
GO

/* ---------- Users (auth for every role) ---------- */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RoleId        INT           NOT NULL,
        SchoolId      INT           NULL,            -- set for Coordinator/Student
        FullName      NVARCHAR(150) NOT NULL,
        Email         NVARCHAR(256) NULL,
        Phone         NVARCHAR(20)  NULL,
        PasswordHash  NVARCHAR(256) NULL,            -- Admin/Coordinator login; Students use OTP
        EmailVerified BIT           NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT 0,
        PhoneVerified BIT           NOT NULL CONSTRAINT DF_Users_PhoneVerified DEFAULT 0,
        Status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_Users_Status        DEFAULT N'Active',
        LastLoginAt   DATETIME2(3)  NULL,
        CreatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Users_Created        DEFAULT SYSUTCDATETIME(),
        UpdatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Users_Updated        DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Users_Roles   FOREIGN KEY (RoleId)   REFERENCES dbo.Roles(RoleId),
        CONSTRAINT FK_Users_Schools FOREIGN KEY (SchoolId) REFERENCES dbo.Schools(SchoolId),
        CONSTRAINT CK_Users_Status  CHECK (Status IN (N'Active', N'Inactive', N'Suspended'))
    );
    -- Email/phone unique only when present (admins may have no phone, etc.)
    CREATE UNIQUE INDEX UQ_Users_Email ON dbo.Users(Email) WHERE Email IS NOT NULL;
    CREATE UNIQUE INDEX UQ_Users_Phone ON dbo.Users(Phone) WHERE Phone IS NOT NULL;
    CREATE INDEX IX_Users_SchoolId ON dbo.Users(SchoolId) WHERE SchoolId IS NOT NULL;
END
GO

/* ---------- Student profiles (1:1 with a Student user) ---------- */
IF OBJECT_ID(N'dbo.StudentProfiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StudentProfiles (
        UserId       BIGINT        NOT NULL PRIMARY KEY,
        Grade        NVARCHAR(20)  NULL,       -- Class
        Section      NVARCHAR(20)  NULL,
        DateOfBirth  DATE          NULL,
        Gender       NVARCHAR(20)  NULL,
        ParentName   NVARCHAR(150) NULL,
        ParentPhone  NVARCHAR(20)  NULL,
        ParentEmail  NVARCHAR(256) NULL,
        City         NVARCHAR(100) NULL,
        ConsentGiven BIT           NOT NULL CONSTRAINT DF_StudentProfiles_Consent DEFAULT 0,
        CreatedAt    DATETIME2(3)  NOT NULL CONSTRAINT DF_StudentProfiles_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_StudentProfiles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
    );
END
GO

/* ---------- OTP requests (dev/audit log; live codes live in Redis in prod) ---------- */
IF OBJECT_ID(N'dbo.OtpRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OtpRequests (
        OtpId        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Target       NVARCHAR(256) NOT NULL,   -- phone or email
        Channel      NVARCHAR(10)  NOT NULL,   -- SMS / Email
        Purpose      NVARCHAR(20)  NOT NULL,   -- Registration / Login
        CodeHash     NVARCHAR(256) NOT NULL,
        ExpiresAt    DATETIME2(3)  NOT NULL,
        ConsumedAt   DATETIME2(3)  NULL,
        AttemptCount INT           NOT NULL CONSTRAINT DF_OtpRequests_Attempts DEFAULT 0,
        CreatedAt    DATETIME2(3)  NOT NULL CONSTRAINT DF_OtpRequests_Created  DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_OtpRequests_Channel CHECK (Channel IN (N'SMS', N'Email')),
        CONSTRAINT CK_OtpRequests_Purpose CHECK (Purpose IN (N'Registration', N'Login'))
    );
    CREATE INDEX IX_OtpRequests_Target ON dbo.OtpRequests(Target, CreatedAt DESC);
END
GO

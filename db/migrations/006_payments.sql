/* =====================================================================
   India Mind League - 006 Payments
   Paytm order/transaction tracking for student/parent payments
   (stage registration fees, bootcamp fees, etc.).
   ===================================================================== */
USE [IndiaMindLeague];
GO

/* ---------- Payments (one row per Paytm order) ---------- */
IF OBJECT_ID(N'dbo.Payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Payments (
        PaymentId       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        OrderId         NVARCHAR(50)   NOT NULL,   -- our ORDERID, sent to Paytm
        UserId          BIGINT         NOT NULL,   -- paying student
        Purpose         NVARCHAR(30)   NOT NULL,   -- STAGE1_REGISTRATION / STAGE3_BOOTCAMP
        Amount          DECIMAL(10,2)  NOT NULL,
        Currency        NVARCHAR(3)    NOT NULL CONSTRAINT DF_Payments_Currency DEFAULT N'INR',
        Status          NVARCHAR(20)   NOT NULL CONSTRAINT DF_Payments_Status   DEFAULT N'CREATED',
        PaytmTxnId      NVARCHAR(64)   NULL,
        PaytmBankTxnId  NVARCHAR(64)   NULL,
        PaymentMode     NVARCHAR(30)   NULL,
        BankName        NVARCHAR(100)  NULL,
        TxnDate         DATETIME2(3)   NULL,
        ResponseCode    NVARCHAR(10)   NULL,
        ResponseMsg     NVARCHAR(400)  NULL,
        GatewayResponse NVARCHAR(MAX)  NULL,        -- raw JSON from the last callback/status check, for audit
        CreatedAt       DATETIME2(3)   NOT NULL CONSTRAINT DF_Payments_Created DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(3)   NOT NULL CONSTRAINT DF_Payments_Updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Payments_Users     FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT UQ_Payments_OrderId   UNIQUE (OrderId),
        CONSTRAINT CK_Payments_Purpose   CHECK (Purpose IN (N'STAGE1_REGISTRATION', N'STAGE3_BOOTCAMP')),
        CONSTRAINT CK_Payments_Status    CHECK (Status IN (N'CREATED', N'PENDING', N'SUCCESS', N'FAILED', N'CANCELLED'))
    );
    CREATE INDEX IX_Payments_UserId ON dbo.Payments(UserId, CreatedAt DESC);
    CREATE INDEX IX_Payments_Status ON dbo.Payments(Status);
END
GO

/* =====================================================================
   India Mind League - 001 Create Database
   Creates the database and enables snapshot isolation so that thousands
   of students auto-saving answers during the live qualifier don't block
   each other (writers don't block readers).
   ===================================================================== */
IF DB_ID(N'IndiaMindLeague') IS NULL
BEGIN
    PRINT 'Creating database IndiaMindLeague...';
    CREATE DATABASE [IndiaMindLeague];
END
ELSE
    PRINT 'Database IndiaMindLeague already exists.';
GO

ALTER DATABASE [IndiaMindLeague] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO
ALTER DATABASE [IndiaMindLeague] SET ALLOW_SNAPSHOT_ISOLATION ON;
GO

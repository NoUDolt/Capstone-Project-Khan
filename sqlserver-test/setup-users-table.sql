
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
  CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL CHECK (Role IN ('user','company','charity','admin')),
    OrganizationName NVARCHAR(200) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE()
  );
  PRINT 'Users table created successfully.';
END
ELSE
BEGIN
  PRINT 'Users table already exists.';
END

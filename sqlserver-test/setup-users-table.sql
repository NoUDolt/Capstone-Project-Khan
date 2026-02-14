-- ==========================================
-- Plateful Users Table Setup
-- Run this script on your SQL Server database
-- ==========================================

-- Create Users table for auth
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

-- Optional: Create a default admin account (password: admin123)
-- The hash below is for 'admin123' using bcryptjs with 10 salt rounds
-- If you want to set your own password, register as a user first, then update the role in SQL:
-- UPDATE dbo.Users SET Role = 'admin' WHERE Username = 'your_username';

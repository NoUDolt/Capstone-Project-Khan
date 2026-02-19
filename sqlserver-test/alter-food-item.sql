-- Add new columns to FoodItem table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FoodItem]') AND name = 'DonorId')
BEGIN
    ALTER TABLE dbo.FoodItem ADD DonorId INT NULL;
    ALTER TABLE dbo.FoodItem ADD CONSTRAINT FK_FoodItem_Donor FOREIGN KEY (DonorId) REFERENCES dbo.Users(Id);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FoodItem]') AND name = 'ClaimantId')
BEGIN
    ALTER TABLE dbo.FoodItem ADD ClaimantId INT NULL;
    ALTER TABLE dbo.FoodItem ADD CONSTRAINT FK_FoodItem_Claimant FOREIGN KEY (ClaimantId) REFERENCES dbo.Users(Id);
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FoodItem]') AND name = 'Status')
BEGIN
    ALTER TABLE dbo.FoodItem ADD Status NVARCHAR(50) DEFAULT 'Available' WITH VALUES;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FoodItem]') AND name = 'ImageUrl')
BEGIN
    ALTER TABLE dbo.FoodItem ADD ImageUrl NVARCHAR(255) NULL;
END

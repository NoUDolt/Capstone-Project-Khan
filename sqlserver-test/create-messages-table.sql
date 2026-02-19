IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Messages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SenderId INT NOT NULL,
        ReceiverId INT NOT NULL,
        ItemId INT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Timestamp DATETIME DEFAULT GETDATE(),
        IsRead BIT DEFAULT 0,
        FOREIGN KEY (SenderId) REFERENCES dbo.Users(Id),
        FOREIGN KEY (ReceiverId) REFERENCES dbo.Users(Id),
        FOREIGN KEY (ItemId) REFERENCES dbo.FoodItem(Id)
    );
END

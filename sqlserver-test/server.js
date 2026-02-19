const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { getPool, sql } = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'plateful-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ============ Auth Endpoints ============

// Register
app.post('/api/register', async (req, res) => {
  const { username, password, role, organizationName } = req.body;

  // Validate inputs
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  // Only allow these roles from the registration page
  const allowedRoles = ['user', 'company', 'charity'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }

  // Company and Charity need an organization name
  if ((role === 'company' || role === 'charity') && !organizationName) {
    return res.status(400).json({ error: 'Organization name is required for ' + role + ' accounts' });
  }

  try {
    const pool = await getPool();

    // Check if username already exists
    const existing = await pool.request()
      .input('Username', sql.NVarChar(100), username)
      .query('SELECT Id FROM dbo.Users WHERE Username = @Username');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await pool.request()
      .input('Username', sql.NVarChar(100), username)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('Role', sql.NVarChar(20), role)
      .input('OrganizationName', sql.NVarChar(200), organizationName || null)
      .query(`INSERT INTO dbo.Users (Username, PasswordHash, Role, OrganizationName)
              OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Role, INSERTED.OrganizationName
              VALUES (@Username, @PasswordHash, @Role, @OrganizationName);`);

    const user = result.recordset[0];

    // Set session
    req.session.user = {
      id: user.Id,
      username: user.Username,
      role: user.Role,
      organizationName: user.OrganizationName
    };

    res.status(201).json(req.session.user);
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar(100), username)
      .query('SELECT Id, Username, PasswordHash, Role, OrganizationName FROM dbo.Users WHERE Username = @Username');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session
    req.session.user = {
      id: user.Id,
      username: user.Username,
      role: user.Role,
      organizationName: user.OrganizationName
    };

    res.json(req.session.user);
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current session
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.json(null);
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ ok: true });
  });
});

// ============ Food Endpoints ============

// Get all food items
app.get('/api/food', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          f.Id, f.Name, f.Quantity, f.ExpirationDate, f.Status, f.ImageUrl, f.DonorId,
          u.Username as DonorName, u.OrganizationName as DonorOrg,
          c.Username as ClaimantName, c.OrganizationName as ClaimantOrg
        FROM dbo.FoodItem f
        LEFT JOIN dbo.Users u ON f.DonorId = u.Id
        LEFT JOIN dbo.Users c ON f.ClaimantId = c.Id
        ORDER BY f.Id DESC;
      `);
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new food item (with image support)
app.post('/api/food', upload.single('image'), async (req, res) => {
  const { name, quantity, expirationDate } = req.body;

  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!name || quantity == null) return res.status(400).json({ error: 'name and quantity are required' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const donorId = req.session.user.id;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Name', sql.NVarChar(100), name)
      .input('Quantity', sql.Int, quantity)
      .input('ExpirationDate', sql.Date, expirationDate || null)
      .input('DonorId', sql.Int, donorId)
      .input('ImageUrl', sql.NVarChar(255), imageUrl)
      .query(`INSERT INTO dbo.FoodItem (Name, Quantity, ExpirationDate, DonorId, ImageUrl, Status)
              OUTPUT INSERTED.* 
              VALUES (@Name, @Quantity, @ExpirationDate, @DonorId, @ImageUrl, 'Available');`);
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete food item
app.delete('/api/food/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = await getPool();

    // Check ownership
    const itemResult = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT DonorId, ClaimantId, Status FROM dbo.FoodItem WHERE Id = @Id');

    if (itemResult.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });

    const item = itemResult.recordset[0];
    const isOwner = item.DonorId === req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';

    // Allow deleting if user is owner OR if it's a legacy item (DonorId is null) and user is admin
    // OR if user is the claimant and the item is claimed
    if (!isOwner && !isAdmin && item.DonorId !== null) {
      const isClaimant = item.ClaimantId === req.session.user.id;
      const isClaimed = item.Status === 'Claimed';

      if (!(isClaimant && isClaimed)) {
        return res.status(403).json({ error: 'You do not have permission to delete this item' });
      }
    }

    // Delete associated messages first
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM dbo.Messages WHERE ItemId = @Id');
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM dbo.FoodItem WHERE Id = @Id;');
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error: ' + e.message });
  }
});

// Claim an item
app.post('/api/food/:id/claim', async (req, res) => {
  const id = Number(req.params.id);
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = await getPool();

    // Check if available
    const check = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Status, DonorId FROM dbo.FoodItem WHERE Id = @Id');

    if (check.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });

    const item = check.recordset[0];
    if (item.Status !== 'Available') {
      return res.status(400).json({ error: 'Item is not available for claim' });
    }

    if (item.DonorId === req.session.user.id) {
      return res.status(400).json({ error: 'You cannot claim your own item' });
    }

    // Update to Pending
    await pool.request()
      .input('Id', sql.Int, id)
      .input('ClaimantId', sql.Int, req.session.user.id)
      .query("UPDATE dbo.FoodItem SET Status = 'Pending', ClaimantId = @ClaimantId WHERE Id = @Id");

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Approve a claim
app.post('/api/food/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = await getPool();

    // Check permissions
    const check = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Status, DonorId FROM dbo.FoodItem WHERE Id = @Id');

    if (check.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });

    const item = check.recordset[0];
    if (item.DonorId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the donor can approve this claim' });
    }

    if (item.Status !== 'Pending') {
      return res.status(400).json({ error: 'Item is not pending approval' });
    }

    // Update to Claimed
    await pool.request()
      .input('Id', sql.Int, id)
      .query("UPDATE dbo.FoodItem SET Status = 'Claimed' WHERE Id = @Id");

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Dashboard endpoint for aggregated stats
app.get('/api/dashboard', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      // Only count 'Available' items for stats that indicate availability
      .query(`
        SELECT 
          COUNT(CASE WHEN Status = 'Available' THEN 1 END) as totalItems,
          SUM(CASE WHEN Status = 'Available' THEN Quantity ELSE 0 END) as totalQuantity,
          SUM(CASE WHEN Status = 'Available' AND ExpirationDate IS NOT NULL AND ExpirationDate <= DATEADD(day, 7, GETDATE()) AND ExpirationDate >= GETDATE() THEN 1 ELSE 0 END) as expiringSoon
        FROM dbo.FoodItem;
      `);
    res.json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel Claim
app.post('/api/food/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = await getPool();

    // Check item
    const check = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Status, DonorId, ClaimantId FROM dbo.FoodItem WHERE Id = @Id');

    if (check.recordset.length === 0) return res.status(404).json({ error: 'Item not found' });

    const item = check.recordset[0];
    const isOwner = item.DonorId === req.session.user.id;
    const isClaimant = item.ClaimantId === req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';

    // Verify status
    if (item.Status !== 'Pending' && item.Status !== 'Claimed') {
      return res.status(400).json({ error: 'Item is not currently claimed or pending' });
    }

    // Verify permission
    if (!isOwner && !isClaimant && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to cancel this claim' });
    }

    // Reset status and ClaimantId
    await pool.request()
      .input('Id', sql.Int, id)
      .query("UPDATE dbo.FoodItem SET Status = 'Available', ClaimantId = NULL WHERE Id = @Id");

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ Chat Endpoints ============

// Get conversations (users communicated with)
app.get('/api/messages/conversations', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = req.session.user.id;

  try {
    const pool = await getPool();
    // Get unique users involved in messages with current user
    const result = await pool.request()
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT DISTINCT 
          CASE WHEN SenderId = @UserId THEN ReceiverId ELSE SenderId END as PartnerId,
          MAX(Timestamp) as LastMessageTime
        FROM dbo.Messages 
        WHERE SenderId = @UserId OR ReceiverId = @UserId
        GROUP BY CASE WHEN SenderId = @UserId THEN ReceiverId ELSE SenderId END
        ORDER BY LastMessageTime DESC
      `);

    const partners = result.recordset;
    if (partners.length === 0) return res.json([]);

    // Get user details for partners
    // Note: In a real app, optimize this to a single query with JOIN
    const partnerIds = partners.map(p => p.PartnerId);
    // Simple loop for now (not efficient for many users but fine for prototype)
    const conversations = [];

    for (const p of partners) {
      const userRes = await pool.request()
        .input('Id', sql.Int, p.PartnerId)
        .query('SELECT Id, Username, OrganizationName FROM dbo.Users WHERE Id = @Id');

      if (userRes.recordset.length > 0) {
        const u = userRes.recordset[0];
        conversations.push({
          ...u,
          lastMessageTime: p.LastMessageTime
        });
      }
    }

    res.json(conversations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get messages with a specific user
app.get('/api/messages/:partnerId', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = req.session.user.id;
  const partnerId = Number(req.params.partnerId);

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.Int, userId)
      .input('PartnerId', sql.Int, partnerId)
      .query(`
        SELECT m.*, u.Username as SenderName
        FROM dbo.Messages m
        JOIN dbo.Users u ON m.SenderId = u.Id
        WHERE (SenderId = @UserId AND ReceiverId = @PartnerId)
           OR (SenderId = @PartnerId AND ReceiverId = @UserId)
        ORDER BY Timestamp ASC
      `);

    // Mark as read (optional optimization: only mark partner's messages)
    await pool.request()
      .input('UserId', sql.Int, userId)
      .input('PartnerId', sql.Int, partnerId)
      .query('UPDATE dbo.Messages SET IsRead = 1 WHERE SenderId = @PartnerId AND ReceiverId = @UserId');

    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Send a message
app.post('/api/messages', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const { receiverId, content, itemId } = req.body;

  if (!receiverId || !content) return res.status(400).json({ error: 'Receiver and content required' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('SenderId', sql.Int, req.session.user.id)
      .input('ReceiverId', sql.Int, receiverId)
      .input('ItemId', sql.Int, itemId || null)
      .input('Content', sql.NVarChar(sql.MAX), content)
      .query(`
        INSERT INTO dbo.Messages (SenderId, ReceiverId, ItemId, Content) 
        VALUES (@SenderId, @ReceiverId, @ItemId, @Content)
      `);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ History Endpoint ============

app.get('/api/history', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = req.session.user.id;

  try {
    const pool = await getPool();
    // Get items where user is donor OR claimant
    const result = await pool.request()
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT 
          f.Id, f.Name, f.Quantity, f.ExpirationDate, f.Status, f.ImageUrl, f.DonorId, f.ClaimantId,
          u.Username as DonorName, u.OrganizationName as DonorOrg,
          c.Username as ClaimantName, c.OrganizationName as ClaimantOrg
        FROM dbo.FoodItem f
        LEFT JOIN dbo.Users u ON f.DonorId = u.Id
        LEFT JOIN dbo.Users c ON f.ClaimantId = c.Id
        WHERE f.DonorId = @UserId OR f.ClaimantId = @UserId
        ORDER BY f.Id DESC
      `);
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server: http://localhost:${port}`));

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { getPool, sql } = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/api/food', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Id, Name, Quantity, ExpirationDate FROM dbo.FoodItem ORDER BY Id DESC;');
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/food', async (req, res) => {
  const { name, quantity, expirationDate } = req.body;
  if (!name || quantity == null) return res.status(400).json({ error: 'name and quantity are required' });
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Name', sql.NVarChar(100), name)
      .input('Quantity', sql.Int, quantity)
      .input('ExpirationDate', sql.Date, expirationDate || null)
      .query(`INSERT INTO dbo.FoodItem (Name, Quantity, ExpirationDate)
              OUTPUT INSERTED.* VALUES (@Name, @Quantity, @ExpirationDate);`);
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/food/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM dbo.FoodItem WHERE Id = @Id;');
    res.status(204).end();
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
      .query(`
        SELECT 
          COUNT(*) as totalItems,
          SUM(Quantity) as totalQuantity,
          SUM(CASE WHEN ExpirationDate IS NOT NULL AND ExpirationDate <= DATEADD(day, 7, GETDATE()) AND ExpirationDate >= GETDATE() THEN 1 ELSE 0 END) as expiringSoon
        FROM dbo.FoodItem;
      `);
    res.json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server: http://localhost:${port}`));

//On Windows Terminal command line run:
//sqllocaldb start MSSQLLocalDB
//On Visual Studio Code Bash terminal run:
//npm run dev

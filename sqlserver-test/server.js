const express = require('express');
const cors = require('cors');
const { getPool, sql } = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

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

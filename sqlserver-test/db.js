// db.js
const sql = require('mssql/msnodesqlv8');
require('dotenv').config();
sql.on('error', err => console.error('MSSQL GLOBAL ERROR:', err, err?.originalError));

const config = {
  driver: 'msnodesqlv8',
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};' +   // <-- 17
    'Server=(localdb)\\MSSQLLocalDB;' +
    `Database=${process.env.SQL_DATABASE};` +
    'Trusted_Connection=Yes;' +
    'TrustServerCertificate=Yes;'
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}

module.exports = { sql, getPool };

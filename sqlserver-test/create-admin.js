const { getPool, sql } = require('./db');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    const username = 'admin';
    const password = 'adminpassword';
    const role = 'admin';
    const orgName = 'Plateful Admin';

    try {
        const pool = await getPool();

        // Check if exists
        const check = await pool.request()
            .input('Username', sql.NVarChar(100), username)
            .query('SELECT Id FROM dbo.Users WHERE Username = @Username');

        if (check.recordset.length > 0) {
            console.log('Admin user already exists.');
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await pool.request()
            .input('Username', sql.NVarChar(100), username)
            .input('PasswordHash', sql.NVarChar(255), hash)
            .input('Role', sql.NVarChar(20), role)
            .input('OrganizationName', sql.NVarChar(200), orgName)
            .query(`INSERT INTO dbo.Users (Username, PasswordHash, Role, OrganizationName) 
                    VALUES (@Username, @PasswordHash, @Role, @OrganizationName)`);

        console.log(`Admin user created.\nUsername: ${username}\nPassword: ${password}`);
    } catch (e) {
        console.error('Error creating admin:', e);
    } finally {
        // Allow time for connection to close if needed, though usually pool handles it
        setTimeout(() => process.exit(0), 1000);
    }
}

createAdmin();

const http = require('http');

function makeRequest(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    console.log('=== Testing Auth API ===\n');

    // 1. Register a company
    console.log('1. Register company...');
    let r = await makeRequest('POST', '/api/register', { username: 'testco', password: 'pass123', role: 'company', organizationName: 'ACME Foods' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 2. Register a charity
    console.log('2. Register charity...');
    r = await makeRequest('POST', '/api/register', { username: 'testcharity', password: 'pass123', role: 'charity', organizationName: 'Local Food Bank' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 3. Register a user
    console.log('3. Register user...');
    r = await makeRequest('POST', '/api/register', { username: 'testuser', password: 'pass123', role: 'user' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 4. Try registering admin (should fail)
    console.log('4. Register admin (should fail)...');
    r = await makeRequest('POST', '/api/register', { username: 'testadmin', password: 'pass123', role: 'admin' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 5. Duplicate username (should fail)
    console.log('5. Duplicate username (should fail)...');
    r = await makeRequest('POST', '/api/register', { username: 'testco', password: 'pass123', role: 'user' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 6. Login
    console.log('6. Login as testco...');
    r = await makeRequest('POST', '/api/login', { username: 'testco', password: 'pass123' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    // 7. Wrong password
    console.log('7. Login wrong password (should fail)...');
    r = await makeRequest('POST', '/api/login', { username: 'testco', password: 'wrong' });
    console.log('   Status:', r.status, '| Data:', JSON.stringify(r.data));

    console.log('\n=== All tests complete ===');
}

test().catch(console.error);

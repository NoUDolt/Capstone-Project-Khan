const http = require('http');

function makeRequest(method, path, data, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie || ''
            }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                let parsed = body;
                try { parsed = JSON.parse(body); } catch { }
                resolve({
                    status: res.statusCode,
                    data: parsed,
                    headers: res.headers
                });
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    console.log('=== Debugging History ===\n');
    let cookie;

    // 1. Register New User
    let r = await makeRequest('POST', '/api/register', { username: 'history_debug_' + Date.now(), password: '123', role: 'user' });
    if (r.headers['set-cookie']) cookie = r.headers['set-cookie'][0];
    const userId = r.data.id;
    console.log('1. Registered User:', r.data.username, `(ID: ${userId})`);

    // 2. Add an item (should appear in history)
    r = await makeRequest('POST', '/api/food', { name: 'History Item 1', quantity: 1 }, cookie);
    console.log('2. Added Item:', r.data.Id);

    // 3. fetch History
    r = await makeRequest('GET', '/api/history', null, cookie);
    console.log('3. History Response:', r.status);
    console.log('   Data Length:', Array.isArray(r.data) ? r.data.length : 'Not Array');
    if (Array.isArray(r.data) && r.data.length > 0) {
        console.log('   Item 1:', r.data[0].Name, '| Status:', r.data[0].Status);
    } else {
        console.log('   Full Data:', JSON.stringify(r.data, null, 2));
    }

    console.log('\n=== Debug Complete ===');
}

test().catch(console.error);

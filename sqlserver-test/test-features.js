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

        // Only write data if it's not null/undefined
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    console.log('=== Testing New Features ===\n');
    let cookieA, cookieB;
    let itemId;

    // 1. Register User A (Donor)
    console.log('1. Register Donor...');
    let r = await makeRequest('POST', '/api/register', { username: 'testdonor_' + Date.now(), password: '123', role: 'company', organizationName: 'TestOrg' });
    if (r.headers['set-cookie']) cookieA = r.headers['set-cookie'][0];
    console.log('   Donor:', r.data.username);

    // 2. Register User B (Claimant)
    console.log('2. Register Claimant...');
    r = await makeRequest('POST', '/api/register', { username: 'testclaimant_' + Date.now(), password: '123', role: 'charity', organizationName: 'TestCharity' });
    if (r.headers['set-cookie']) cookieB = r.headers['set-cookie'][0];
    console.log('   Claimant:', r.data.username);

    // 3. Donor adds item
    console.log('3. Donor adds item...');
    r = await makeRequest('POST', '/api/food', { name: 'Test Bread', quantity: 10, expirationDate: '2026-12-31' }, cookieA);
    itemId = r.data.Id;
    console.log('   Item ID:', itemId, '| Status:', r.status);

    // 4. Claimant claims item
    console.log('4. Claimant claims item...');
    r = await makeRequest('POST', `/api/food/${itemId}/claim`, {}, cookieB); // Empty body is fine for POST
    console.log('   Claim Status:', r.status);

    // 5. Verify item is Pending
    console.log('5. Verify Pending status...');
    r = await makeRequest('GET', '/api/food');
    const item = r.data.find(i => i.Id === itemId);
    console.log('   Status:', item ? item.Status : 'Not Found', '| Claimant:', item ? item.ClaimantName : 'N/A');

    // 6. Donor approves
    console.log('6. Donor approves...');
    r = await makeRequest('POST', `/api/food/${itemId}/approve`, {}, cookieA);
    console.log('   Approve Status:', r.status);

    // 7. Verify item is Claimed
    console.log('7. Verify Claimed status...');
    r = await makeRequest('GET', '/api/food');
    const itemClaimed = r.data.find(i => i.Id === itemId);
    console.log('   Status:', itemClaimed ? itemClaimed.Status : 'Not Found');

    // 8. Claimant tries to delete (should fail)
    console.log('8. Claimant tries to delete (should fail)...');
    // Pass null for data to avoid sending a body with DELETE
    r = await makeRequest('DELETE', `/api/food/${itemId}`, null, cookieB);
    console.log('   Delete Status (Expected 403):', r.status);
    if (r.status !== 403) console.log('   Response Data:', JSON.stringify(r.data));

    // 9. Donor deletes item
    console.log('9. Donor deletes item...');
    r = await makeRequest('DELETE', `/api/food/${itemId}`, null, cookieA);
    console.log('   Delete Status (Expected 204):', r.status);
    if (r.status !== 204) console.log('   Response Data:', JSON.stringify(r.data));

    console.log('\n=== Tests Complete ===');
}

test().catch(console.error);

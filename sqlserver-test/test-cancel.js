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
    console.log('=== Testing Cancel Claim ===\n');
    let cookieD, cookieC;
    let itemId;

    // 1. Register User D (Donor)
    let r = await makeRequest('POST', '/api/register', { username: 'cancel_donor_' + Date.now(), password: '123', role: 'company', organizationName: 'CancelOrg' });
    if (r.headers['set-cookie']) cookieD = r.headers['set-cookie'][0];
    const donorId = r.data.id;
    console.log('1. User D (Donor):', r.data.username);

    // 2. Register User C (Claimant)
    r = await makeRequest('POST', '/api/register', { username: 'cancel_claimant_' + Date.now(), password: '123', role: 'charity', organizationName: 'CancelCharity' });
    if (r.headers['set-cookie']) cookieC = r.headers['set-cookie'][0];
    console.log('2. User C (Claimant):', r.data.username);

    // 3. Post Item
    r = await makeRequest('POST', '/api/food', { name: 'Cancel Test Item', quantity: 1 }, cookieD);
    itemId = r.data.Id;
    console.log('3. Item Posted:', itemId);

    // 4. Claim Item (User C)
    await makeRequest('POST', `/api/food/${itemId}/claim`, {}, cookieC);
    console.log('4. Item Claimed by C');

    // 5. Cancel Item (User C - Claimant)
    r = await makeRequest('POST', `/api/food/${itemId}/cancel`, {}, cookieC);
    console.log('5. Cancel by Claimant Status:', r.status);

    // 6. Verify Available
    r = await makeRequest('GET', '/api/food', null, cookieD);
    let item = r.data.find(i => i.Id === itemId);
    console.log('   - Item Status (Available):', item.Status);
    console.log('   - ClaimantId (null):', item.ClaimantId);

    // 7. Claim Again (User C)
    await makeRequest('POST', `/api/food/${itemId}/claim`, {}, cookieC);
    console.log('7. Item Claimed Again by C');

    // 8. Cancel Item (User D - Donor)
    r = await makeRequest('POST', `/api/food/${itemId}/cancel`, {}, cookieD);
    console.log('8. Cancel by Donor Status:', r.status);

    // 9. Verify Available
    r = await makeRequest('GET', '/api/food', null, cookieD);
    item = r.data.find(i => i.Id === itemId);
    console.log('   - Item Status (Available):', item.Status);

    console.log('\n=== Test Complete ===');
}

test().catch(console.error);

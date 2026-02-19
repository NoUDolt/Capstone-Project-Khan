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
    console.log('=== Testing Chat & History ===\n');
    let cookieA, cookieB;
    let itemId;
    let partnerId;

    // 1. Register User A (Donor)
    let r = await makeRequest('POST', '/api/register', { username: 'chat_donor_' + Date.now(), password: '123', role: 'company', organizationName: 'ChatOrg' });
    if (r.headers['set-cookie']) cookieA = r.headers['set-cookie'][0];
    const donorId = r.data.id;
    console.log('1. User A (Donor):', r.data.username, `(ID: ${donorId})`);

    // 2. Register User B (Claimant)
    r = await makeRequest('POST', '/api/register', { username: 'chat_claimant_' + Date.now(), password: '123', role: 'charity', organizationName: 'ChatCharity' });
    if (r.headers['set-cookie']) cookieB = r.headers['set-cookie'][0];
    const claimantId = r.data.id;
    console.log('2. User B (Claimant):', r.data.username, `(ID: ${claimantId})`);

    // 3. User A posts item
    r = await makeRequest('POST', '/api/food', { name: 'Chat Item', quantity: 5 }, cookieA);
    itemId = r.data.Id;
    console.log('3. Item Posted:', itemId);

    // 4. Chat exchange
    console.log('4. Testing Chat...');
    // B sends message to A
    await makeRequest('POST', '/api/messages', { receiverId: donorId, content: 'Is this still available?', itemId }, cookieB);
    console.log('   - B sent message');

    // A checks messages
    r = await makeRequest('GET', `/api/messages/${claimantId}`, null, cookieA);
    console.log('   - A received messages count:', r.data.length);
    console.log('   - Content:', r.data[0].Content);

    // A replies
    await makeRequest('POST', '/api/messages', { receiverId: claimantId, content: 'Yes it is!' }, cookieA);
    console.log('   - A replied');

    // 5. Claim process
    console.log('5. Testing Claim & History...');
    await makeRequest('POST', `/api/food/${itemId}/claim`, {}, cookieB); // B claims
    await makeRequest('POST', `/api/food/${itemId}/approve`, {}, cookieA); // A approves

    // 6. Check History (User B)
    r = await makeRequest('GET', '/api/history', null, cookieB);
    const historyItem = r.data.find(i => i.Id === itemId);
    console.log('   - B History contains item:', !!historyItem);
    console.log('   - Item Status in History:', historyItem ? historyItem.Status : 'N/A');

    // 7. Test Delete Permission (Claimant deleting Claimed item)
    console.log('7. Testing Claimant Deletion...');
    r = await makeRequest('DELETE', `/api/food/${itemId}`, null, cookieB);
    console.log('   - Delete Status (Expected 204):', r.status);
    if (r.status !== 204) console.log('   - Error:', JSON.stringify(r.data));

    console.log('\n=== Test Complete ===');
}

test().catch(console.error);

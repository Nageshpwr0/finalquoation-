const fetch = require('node-fetch');

const apiUrl = 'http://localhost:3002';

async function testAPI() {
    try {
        // Test adding a customer
        console.log('Testing customer creation...');
        const customerResponse = await fetch(`${apiUrl}/api/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerName: 'Test Customer',
                customerCompanyName: 'Test Company',
                address: '123 Test St',
                email: 'test@test.com',
                mobileNumber: '1234567890'
            })
        });
        const customerResult = await customerResponse.json();
        console.log('Customer creation result:', customerResult);

        // Test getting customers
        console.log('\nTesting customer retrieval...');
        const getCustomersResponse = await fetch(`${apiUrl}/api/customers`);
        const customersResult = await getCustomersResponse.json();
        console.log('Customers:', customersResult);

        // Test adding a paper type
        console.log('\nTesting paper type creation...');
        const paperResponse = await fetch(`${apiUrl}/api/papertypes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paperTypeName: 'Test Paper',
                ratePerKg: 100,
                minGsm: 200,
                maxGsm: 400
            })
        });
        const paperResult = await paperResponse.json();
        console.log('Paper type creation result:', paperResult);

        // Test getting paper types
        console.log('\nTesting paper type retrieval...');
        const getPaperResponse = await fetch(`${apiUrl}/api/papertypes`);
        const paperTypesResult = await getPaperResponse.json();
        console.log('Paper types:', paperTypesResult);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAPI();
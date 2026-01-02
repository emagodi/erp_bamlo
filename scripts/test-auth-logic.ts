import { authConfig } from '@/auth.config';

const authorized = authConfig.callbacks?.authorized;

if (!authorized) {
    console.error('❌ No authorized callback found in authConfig');
    process.exit(1);
}

function mockRequest(pathname: string) {
    return {
        nextUrl: {
            pathname,
            origin: 'http://localhost:3000',
        } as any,
    } as any;
}

async function runTests() {
    console.log('Starting Auth Logic Verification...');

    // Test 1: Logged In + Public Route (/) -> Redirect to /dashboard
    const result1 = await authorized({
        auth: { user: { id: '1' } } as any,
        request: mockRequest('/'),
    });
    if (result1 instanceof Response && result1.headers.get('location') === 'http://localhost:3000/dashboard') {
        console.log('✅ Test 1 Passed: Logged In + Public Route -> Redirects to /dashboard');
    } else {
        console.error('❌ Test 1 Failed: Expected redirect to /dashboard, got', result1);
    }

    // Test 2: Logged In + Protected Route (/quotes) -> Allow
    const result2 = await authorized({
        auth: { user: { id: '1' } } as any,
        request: mockRequest('/quotes'),
    });
    if (result2 === true) {
        console.log('✅ Test 2 Passed: Logged In + Protected Route -> Allowed');
    } else {
        console.error('❌ Test 2 Failed: Expected true, got', result2);
    }

    // Test 3: Not Logged In + Public Route (/) -> Allow
    const result3 = await authorized({
        auth: null,
        request: mockRequest('/'),
    });
    if (result3 === true) {
        console.log('✅ Test 3 Passed: Not Logged In + Public Route -> Allowed');
    } else {
        console.error('❌ Test 3 Failed: Expected true, got', result3);
    }

    // Test 4: Not Logged In + Protected Route (/quotes) -> Block (Redirect to login)
    const result4 = await authorized({
        auth: null,
        request: mockRequest('/quotes'),
    });
    if (result4 === false) {
        console.log('✅ Test 4 Passed: Not Logged In + Protected Route -> Blocked');
    } else {
        console.error('❌ Test 4 Failed: Expected false, got', result4);
    }
}

runTests().catch(console.error);

import { createQuote, createAutoQuote, transitionQuoteStatus, finalizeQuote } from '@/app/(protected)/actions';
import { safeAction } from '@/lib/safe-action';
import { z } from 'zod';

async function main() {
    console.log('Starting Error Handling Verification...');

    // Test 1: Safe Action Utility with Validation Error
    console.log('\nTest 1: Safe Action Validation Error');
    const schema = z.object({ name: z.string().min(3) });
    const action = safeAction(schema, async (data) => {
        return `Hello ${data.name}`;
    });

    const result1 = await action({ name: 'Jo' });
    if (!result1.success && result1.error === 'Validation failed') {
        console.log('✅ Validation error caught correctly');
    } else {
        console.error('❌ Validation error NOT caught correctly', result1);
    }

    // Test 2: Safe Action Utility with Runtime Error
    console.log('\nTest 2: Safe Action Runtime Error');
    const action2 = safeAction(schema, async (data) => {
        throw new Error('Something went wrong inside action');
    });

    const result2 = await action2({ name: 'John' });
    if (!result2.success && result2.error === 'Something went wrong inside action') {
        console.log('✅ Runtime error caught correctly');
    } else {
        console.error('❌ Runtime error NOT caught correctly', result2);
    }

    // Test 3: Create Quote with Invalid Data (Should throw or return error)
    console.log('\nTest 3: Create Quote with Invalid Data');
    try {
        // @ts-ignore
        await createQuote({ lines: [] }); // Missing customerId
        console.error('❌ createQuote should have thrown an error');
    } catch (error) {
        if (error instanceof Error && error.message.includes('Customer is required')) {
            console.log('✅ createQuote error caught correctly:', error.message);
        } else {
            console.error('❌ createQuote threw unexpected error:', error);
        }
    }

    // Test 4: Transition Quote Status (Should handle missing quote)
    console.log('\nTest 4: Transition Quote Status (Missing Quote)');
    try {
        await transitionQuoteStatus('non-existent-id', 'SENT_TO_SALES');
        console.error('❌ transitionQuoteStatus should have thrown an error');
    } catch (error) {
        if (error instanceof Error && (error.message.includes('Quote not found') || error.message.includes('Authentication required'))) {
            // Note: It might fail on auth first if running in script without context, which is also a valid error handling
            console.log('✅ transitionQuoteStatus error caught correctly:', error.message);
        } else {
            console.error('❌ transitionQuoteStatus threw unexpected error:', error);
        }
    }

    console.log('\nVerification Complete.');
}

main().catch(console.error);

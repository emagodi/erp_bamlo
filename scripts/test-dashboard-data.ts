import { fetchCardData, fetchRevenueData, fetchRecentQuotes } from '@/lib/dashboard';

async function runTests() {
    console.log('Starting Dashboard Data Verification...');

    try {
        // Test 1: Card Data
        console.log('Fetching Card Data...');
        const cardData = await fetchCardData();
        console.log('✅ Card Data:', cardData);
        if (typeof cardData.totalRevenue !== 'number') throw new Error('Invalid totalRevenue');

        // Test 2: Revenue Data
        console.log('Fetching Revenue Data...');
        const revenueData = await fetchRevenueData();
        console.log('✅ Revenue Data (first 3):', revenueData.slice(0, 3));
        if (!Array.isArray(revenueData)) throw new Error('Revenue data is not an array');

        // Test 3: Recent Quotes
        console.log('Fetching Recent Quotes...');
        const recentQuotes = await fetchRecentQuotes();
        console.log('✅ Recent Quotes (first 2):', recentQuotes.slice(0, 2));
        if (!Array.isArray(recentQuotes)) throw new Error('Recent quotes is not an array');

        console.log('🎉 All dashboard data tests passed!');
    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}

runTests();

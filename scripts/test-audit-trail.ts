import { prisma } from "@/lib/db";

async function testAuditTrail() {
    console.log("=== Audit Trail System Test ===\n");

    try {
        // Test 1: Check if UserActionLog table exists and has data
        console.log("Test 1: Checking UserActionLog table...");
        const totalLogs = await prisma.userActionLog.count();
        console.log(`✓ Found ${totalLogs} total logs in database\n`);

        // Test 2: Fetch recent logs with user information
        console.log("Test 2: Fetching recent logs with user details...");
        const recentLogs = await prisma.userActionLog.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });

        if (recentLogs.length > 0) {
            console.log(`✓ Retrieved ${recentLogs.length} recent logs:`);
            recentLogs.forEach((log, idx) => {
                console.log(`  ${idx + 1}. [${log.createdAt.toISOString()}]`);
                console.log(`     User: ${log.user.email} (${log.user.role})`);
                console.log(`     Action: ${log.method} ${log.path}`);
                console.log(`     IP: ${log.ip || 'N/A'}`);
            });
            console.log();
        } else {
            console.log("⚠ No logs found. System may not have captured any actions yet.\n");
        }

        // Test 3: Test filtering by method
        console.log("Test 3: Testing filter by method (GET)...");
        const getLogs = await prisma.userActionLog.count({
            where: { method: 'GET' },
        });
        console.log(`✓ Found ${getLogs} GET requests\n`);

        // Test 4: Test filtering by method (POST)
        console.log("Test 4: Testing filter by method (POST)...");
        const postLogs = await prisma.userActionLog.count({
            where: { method: 'POST' },
        });
        console.log(`✓ Found ${postLogs} POST requests\n`);

        // Test 5: Get unique users who have logged actions
        console.log("Test 5: Checking unique users with logged actions...");
        const usersWithLogs = await prisma.userActionLog.findMany({
            distinct: ['userId'],
            select: {
                user: {
                    select: {
                        email: true,
                        role: true,
                    },
                },
            },
        });
        console.log(`✓ Found ${usersWithLogs.length} unique users with logged actions:`);
        usersWithLogs.forEach((log, idx) => {
            console.log(`  ${idx + 1}. ${log.user.email} (${log.user.role})`);
        });
        console.log();

        // Test 6: Test date range filtering (last 24 hours)
        console.log("Test 6: Testing date range filter (last 24 hours)...");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const last24Hours = await prisma.userActionLog.count({
            where: {
                createdAt: {
                    gte: yesterday,
                },
            },
        });
        console.log(`✓ Found ${last24Hours} logs in the last 24 hours\n`);

        // Test 7: Test path filtering
        console.log("Test 7: Testing path filtering (contains 'audit')...");
        const auditPathLogs = await prisma.userActionLog.count({
            where: {
                path: {
                    contains: 'audit',
                    mode: 'insensitive',
                },
            },
        });
        console.log(`✓ Found ${auditPathLogs} logs with 'audit' in path\n`);

        // Test 8: Get statistics by HTTP method
        console.log("Test 8: Getting statistics by HTTP method...");
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        for (const method of methods) {
            const count = await prisma.userActionLog.count({
                where: { method },
            });
            if (count > 0) {
                console.log(`  ${method}: ${count} requests`);
            }
        }
        console.log();

        // Test 9: Check for logs with IP addresses
        console.log("Test 9: Checking logs with IP address information...");
        const logsWithIP = await prisma.userActionLog.count({
            where: {
                ip: {
                    not: null,
                },
            },
        });
        console.log(`✓ Found ${logsWithIP} logs with IP addresses\n`);

        // Test 10: Check for logs with User Agent information
        console.log("Test 10: Checking logs with User Agent information...");
        const logsWithUA = await prisma.userActionLog.count({
            where: {
                userAgent: {
                    not: null,
                },
            },
        });
        console.log(`✓ Found ${logsWithUA} logs with User Agent information\n`);

        console.log("=== All Tests Completed Successfully ===");
        console.log("\nSummary:");
        console.log(`- Total logs: ${totalLogs}`);
        console.log(`- Unique users: ${usersWithLogs.length}`);
        console.log(`- Logs in last 24h: ${last24Hours}`);
        console.log(`- Logs with IP: ${logsWithIP}`);
        console.log(`- Logs with User Agent: ${logsWithUA}`);

    } catch (error) {
        console.error("❌ Test failed with error:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

testAuditTrail();

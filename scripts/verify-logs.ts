import { prisma } from "@/lib/db";

async function checkLogs() {
    try {
        const logs = await prisma.userActionLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { user: true }
        });

        console.log("Found " + logs.length + " logs.");
        logs.forEach(log => {
            console.log(`[${log.createdAt.toISOString()}] ${log.user.email} - ${log.method} ${log.path}`);
        });
    } catch (error) {
        console.error("Error fetching logs:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLogs();

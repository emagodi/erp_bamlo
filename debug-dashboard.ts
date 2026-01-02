
import { prisma } from './lib/db';
import { getCurrentUser } from './lib/auth';

async function main() {
    console.log('--- DEBUG START ---');

    // 1. Check all users and roles to see who is what
    const users = await prisma.user.findMany({
        select: { email: true, role: true, name: true }
    });
    console.log('Users in DB:', JSON.stringify(users, null, 2));

    // 2. Check Purchase Orders
    const pos = await prisma.purchaseOrder.findMany({
        select: { id: true, status: true, vendor: true, createdAt: true }
    });
    console.log(`Found ${pos.length} POs:`);
    console.table(pos);

    // 3. Simulating the dashboard query
    const securityIncoming = await prisma.purchaseOrder.findMany({
        where: {
            status: { in: ['SUBMITTED', 'DRAFT', 'ORDERED', 'PENDING'] },
        },
        select: { id: true, status: true }
    });
    console.log(`Dashboard Query would find: ${securityIncoming.length} items`);

    console.log('--- DEBUG END ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

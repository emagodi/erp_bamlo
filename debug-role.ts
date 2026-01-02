import { prisma } from './lib/db';

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: { name: true, email: true, role: true }
        });
        console.log('All Users:', JSON.stringify(users, null, 2));

        const requests = await prisma.fundingRequest.findMany();
        console.log('Funding Requests:', JSON.stringify(requests, null, 2));
    } catch (e: any) {
        console.error('ERROR:', e.message, e);
    }
}

main();

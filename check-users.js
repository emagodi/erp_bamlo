const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany();
        console.log('Users found:');
        console.log(JSON.stringify(users.map(u => ({ email: u.email, role: u.role })), null, 2));
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

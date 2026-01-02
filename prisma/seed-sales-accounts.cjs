const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Sales Accounts user...');

    const passwordHash = await bcrypt.hash('password123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'salesaccount@example.com' },
        update: {
            role: 'SALES_ACCOUNTS',
            name: 'Sales Accounts',
        },
        create: {
            email: 'salesaccount@example.com',
            name: 'Sales Accounts',
            role: 'SALES_ACCOUNTS',
            passwordHash,
        },
    });

    console.log('✅ Sales Accounts user created:', user.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

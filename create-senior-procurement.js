
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'seniorprocurement@example.com';
    const password = 'Password01';
    const role = 'SENIOR_PROCUREMENT';
    const office = 'hq';

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            role,
            office,
        },
        create: {
            email,
            name: 'Senior Procurement',
            passwordHash: hashedPassword,
            role,
            office,
        },
    });

    console.log(`User created/updated: ${user.email} with role ${user.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

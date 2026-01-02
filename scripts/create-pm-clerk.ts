import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'pmclerk@example.com';
    const password = 'Password01';
    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            role: 'PM_CLERK',
        },
        create: {
            email,
            passwordHash: hashedPassword,
            role: 'PM_CLERK',
            name: 'PM Clerk',
        },
    });

    console.log('Created/Updated user:', user.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

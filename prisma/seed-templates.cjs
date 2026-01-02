const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Task Templates...');

    const templates = [
        {
            key: 'EXCAVATION',
            name: 'Excavation',
            hoursPerUnit: 1.6, // 5m per day (8 hours) -> 8 / 5 = 1.6 hours/m
            unitLabel: 'm',
        },
        {
            key: 'BUILDING',
            name: 'Building',
            hoursPerUnit: 0.016, // 500 bricks per day -> 8 / 500 = 0.016 hours/brick
            unitLabel: 'bricks',
        },
        {
            key: 'PLASTERING',
            name: 'Plastering',
            hoursPerUnit: 0.5, // 16 sqm per day -> 8 / 16 = 0.5 hours/sqm
            unitLabel: 'sqm',
        },
        {
            key: 'CONCRETE',
            name: 'Concrete Works',
            hoursPerUnit: 1.6, // 5 cubic per day -> 8 / 5 = 1.6 hours/cubic
            unitLabel: 'cubic meters',
        },
    ];

    for (const template of templates) {
        await prisma.taskTemplate.upsert({
            where: { key: template.key },
            update: template,
            create: template,
        });
    }

    console.log('✅ Task Templates seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

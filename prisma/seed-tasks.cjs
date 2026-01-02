const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.taskTemplate.upsert({
    where: { key: 'FOUNDATION_DIG' },
    update: {},
    create: {
      key: 'FOUNDATION_DIG',
      name: 'Foundation Digging',
      hoursPerUnit: 2.5,
      unitLabel: 'm3',
      complexityFactor: 1.0,
    },
  });

  await prisma.taskTemplate.upsert({
    where: { key: 'BRICKWORK' },
    update: {},
    create: {
      key: 'BRICKWORK',
      name: 'Brickwork',
      hoursPerUnit: 0.08, // 0.08h per brick (≈ 7.5 bricks/hr/person, adjust)
      unitLabel: 'bricks',
      complexityFactor: 1.2,
    },
  });
}

main().finally(() => prisma.$disconnect());

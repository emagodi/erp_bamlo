// prisma/seed.cjs
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // PMs
  const pmA = await prisma.user.upsert({
    where: { email: 'pm@bamlo.com' },
    update: {},
    create: {
      email: 'pm@bamlo.com',
      name: 'Project Manager A',
      role: 'PROJECT_MANAGER',
      office: 'Office A',
      passwordHash: await bcrypt.hash('Password01', 10),
    },
  });

  const pmB = await prisma.user.upsert({
    where: { email: 'pm.b@example.com' },
    update: {},
    create: {
      email: 'pm.b@example.com',
      name: 'Project Manager B',
      role: 'PROJECT_MANAGER',
      office: 'Office B',
      passwordHash: await bcrypt.hash('Password01', 10),
    },
  });

  // Team under PM A
  const teamA = await Promise.all([
    prisma.user.upsert({
      where: { email: 'worker1@a.example.com' },
      update: {},
      create: {
        email: 'worker1@a.example.com',
        name: 'Worker 1 (A)',
        role: 'PROJECT_TEAM',
        office: 'Office A',
        managerId: pmA.id,        // <-- belongs to PM A
        passwordHash: await bcrypt.hash('Password01', 10),
      },
    }),
    prisma.user.upsert({
      where: { email: 'worker2@a.example.com' },
      update: {},
      create: {
        email: 'worker2@a.example.com',
        name: 'Worker 2 (A)',
        role: 'PROJECT_TEAM',
        office: 'Office A',
        managerId: pmA.id,
        passwordHash: await bcrypt.hash('Password01', 10),
      },
    }),
    prisma.user.upsert({
      where: { email: 'worker3@a.example.com' },
      update: {},
      create: {
        email: 'worker3@a.example.com',
        name: 'Worker 3 (A)',
        role: 'PROJECT_TEAM',
        office: 'Office A',
        managerId: pmA.id,
        passwordHash: await bcrypt.hash('Password01', 10),
      },
    }),
  ]);

  // Team under PM B
  const teamB = await Promise.all([
    prisma.user.upsert({
      where: { email: 'worker1@b.example.com' },
      update: {},
      create: {
        email: 'worker1@b.example.com',
        name: 'Worker 1 (B)',
        role: 'PROJECT_TEAM',
        office: 'Office B',
        managerId: pmB.id,
        passwordHash: await bcrypt.hash('Password01', 10),
      },
    }),
  ]);

 

  console.log('Seeded PMs, teams, and project membership.');
}

main().finally(() => prisma.$disconnect());

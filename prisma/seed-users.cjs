const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding core users...');
  const defaultPassword = 'Password01';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const users = [
    { email: 'md@example.com', name: 'Managing Director', role: 'MANAGING_DIRECTOR', office: null },
    { email: 'gm-office-a@example.com', name: 'General Manager Office A', role: 'GENERAL_MANAGER', office: 'OFFICE_A' },
    { email: 'coordinator@example.com', name: 'Coordinator', role: 'COORDINATOR', office: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, office: u.office ?? null, passwordHash },
      create: { email: u.email, name: u.name, role: u.role, office: u.office ?? null, passwordHash },
    });
    console.log(`✔ ${u.name} (${u.role})`);
  }

  console.log('Default password:', defaultPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

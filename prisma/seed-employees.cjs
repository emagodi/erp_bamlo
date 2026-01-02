const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 10 employees and accounts...');

  const employees = [
    // 5 Builders
    { givenName: 'John', surname: 'Doe', role: 'BUILDER', phone: '+263771234567', email: 'john.doe@example.com' },
    { givenName: 'James', surname: 'Smith', role: 'BUILDER', phone: '+263771234568', email: 'james.smith@example.com' },
    { givenName: 'Robert', surname: 'Johnson', role: 'BUILDER', phone: '+263771234569', email: 'robert.johnson@example.com' },
    { givenName: 'Michael', surname: 'Williams', role: 'BUILDER', phone: '+263771234570', email: 'michael.williams@example.com' },
    { givenName: 'David', surname: 'Brown', role: 'BUILDER', phone: '+263771234571', email: 'david.brown@example.com' },

    // 5 Assistants
    { givenName: 'Sarah', surname: 'Jones', role: 'ASSISTANT', phone: '+263771234572', email: 'sarah.jones@example.com' },
    { givenName: 'Emily', surname: 'Garcia', role: 'ASSISTANT', phone: '+263771234573', email: 'emily.garcia@example.com' },
    { givenName: 'Jessica', surname: 'Martinez', role: 'ASSISTANT', phone: '+263771234574', email: 'jessica.martinez@example.com' },
    { givenName: 'Ashley', surname: 'Rodriguez', role: 'ASSISTANT', phone: '+263771234575', email: 'ashley.rodriguez@example.com' },
    { givenName: 'Michelle', surname: 'Wilson', role: 'ASSISTANT', phone: '+263771234576', email: 'michelle.wilson@example.com' },
  ];

  const defaultPassword = 'Password01';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  for (const emp of employees) {
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: { name: `${emp.givenName} ${emp.surname}`, role: 'PROJECT_TEAM', passwordHash },
      create: {
        email: emp.email,
        name: `${emp.givenName} ${emp.surname}`,
        role: 'PROJECT_TEAM',
        passwordHash,
      },
    });

    await prisma.employee.upsert({
      where: { email: emp.email },
      update: { ...emp, userId: user.id },
      create: { ...emp, userId: user.id },
    });
    console.log(`✔ ${emp.givenName} ${emp.surname} (${emp.role})`);
  }

  console.log(`\n✔ Seeded ${employees.length} employees + accounts`);
  console.log(`   Default password: ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

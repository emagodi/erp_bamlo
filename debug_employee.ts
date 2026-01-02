import { prisma } from './lib/db';

async function main() {
  const email = 'john.carpenter@example.com';
  console.log('Checking for:', email);

  const user = await prisma.user.findUnique({ where: { email } });
  console.log('User:', user);

  const emp = await prisma.employee.findUnique({ where: { email } });
  console.log('Employee:', emp);

  if (user || emp) {
    console.log('Deleting existing records...');
    if (emp) await prisma.employee.delete({ where: { id: emp.id } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    console.log('Deleted.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

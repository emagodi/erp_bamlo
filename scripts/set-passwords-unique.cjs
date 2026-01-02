// scripts/set-passwords-unique.cjs
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  datasourceUrl: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL,
});

(async () => {
  try {
    const users = await prisma.user.findMany({
      where: { OR: [{ passwordHash: null }, { passwordHash: '' }] },
      select: { id: true, email: true },
    });

    for (const u of users) {
      const passwordHash = await bcrypt.hash('Password01', 12);
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash },
      });
      console.log(`✓ ${u.email}`);
    }

    console.log(`Done. Updated ${users.length} users.`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

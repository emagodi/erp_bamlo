const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  try {
    const passwordHash = await bcrypt.hash('Password@123', 10);
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { passwordHash },
    });
    console.log('Password reset successfully for admin@example.com');
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

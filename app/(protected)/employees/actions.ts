'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { revalidatePath } from 'next/cache';

function assertCanManage(role: string | null | undefined) {
  if (!['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_MANAGER'].includes(role || '')) {
    throw new Error('Only Admin, Managing Director or Project Manager can manage employees');
  }
}

export async function createEmployee(formData: FormData) {
  const user = await getCurrentUser();
  console.log('createEmployee called by:', user?.email, user?.role);
  if (!user) throw new Error('Auth required');
  try {
    assertCanManage((user as any).role);
  } catch (e) {
    console.error('assertCanManage failed:', e);
    throw e;
  }

  const givenName = String(formData.get('givenName') || '').trim();
  const surname = String(formData.get('surname') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const phone = String(formData.get('phone') || '').trim();
  const role = String(formData.get('role') || '').trim().toUpperCase();
  const office = String(formData.get('office') || '').trim();

  if (!givenName || !email) throw new Error('Name and email are required');

  const defaultPassword = 'Password01';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  try {
    const account = await prisma.user.upsert({
      where: { email },
      update: { name: `${givenName} ${surname}`.trim(), role: 'PROJECT_TEAM', passwordHash },
      create: { email, name: `${givenName} ${surname}`.trim(), role: 'PROJECT_TEAM', passwordHash },
      select: { id: true },
    });
    console.log('User upserted:', account.id);

    await prisma.employee.upsert({
      where: { email },
      update: { givenName, surname, role, phone, email, office: office || null, userId: account.id },
      create: { givenName, surname, role, phone, email, office: office || null, userId: account.id },
    });
    console.log('Employee upserted');
  } catch (e) {
    console.error('Error in createEmployee DB ops:', e);
    throw e;
  }

  revalidatePath('/employees');
  return { ok: true, defaultPassword };
}

// app/(protected)/dispatches/[dispatchId]/receipt/server-actions.ts
'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function markDispatchSent(dispatchId: string) {
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: 'SENT', sentAt: new Date() },
  });
  revalidatePath(`/dispatches/${dispatchId}/receipt`);
  redirect(`/dispatches/${dispatchId}/receipt`);
}

export async function markDispatchReceived(dispatchId: string) {
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: 'RECEIVED', receivedAt: new Date() },
  });
  revalidatePath(`/dispatches/${dispatchId}/receipt`);
  redirect(`/dispatches/${dispatchId}/receipt`);
}

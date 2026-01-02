'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { toMinor } from '@/helpers/money';

export async function recordClientPayment(projectId: string, args: {
  type: 'DEPOSIT' | 'INSTALLMENT' | 'ADJUSTMENT',
  amount: number,
  receivedAt: string, // yyyy-mm-dd
  receiptNo?: string | null,
  method?: string | null,
  attachmentUrl?: string | null,
}) {
  const me = await getCurrentUser();
  assertRoles(me?.role, ['SALES_ACCOUNTS','ADMIN']);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!project) throw new Error('Project not found');
  const needsDeposit = project.status === 'CREATED' || project.status === 'DEPOSIT_PENDING';

  const amountMinor = toMinor(args.amount);
  if (amountMinor <= 0n) throw new Error('Invalid amount');

  await prisma.clientPayment.create({
    data: {
      projectId,
      type: args.type,
      amountMinor,
      receivedAt: new Date(args.receivedAt),
      receiptNo: args.receiptNo ?? null,
      method: args.method ?? null,
      attachmentUrl: args.attachmentUrl ?? null,
      recordedById: me!.id!,
    },
  });

  if (args.type === 'DEPOSIT' && needsDeposit) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'PLANNED' },
    });
  }
}

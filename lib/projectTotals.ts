// lib/projectTotals.ts
import { prisma } from '@/lib/db';

export async function projectApprovedSpendMinor(projectId: string) {
  const agg = await prisma.purchaseOrder.aggregate({
    where: { projectId, status: { in: ['APPROVED', 'ORDERED', 'RECEIVED', 'COMPLETE'] } },
    _sum: { approvedMinor: true },
  });
  return BigInt(agg._sum.approvedMinor ?? 0);
}

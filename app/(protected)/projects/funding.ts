import { prisma } from '@/lib/db';

export async function getFundingSnapshot(requisitionId: string) {
  const [req, purchases] = await Promise.all([
    prisma.fundingRequest.findMany({
      where: { requisitionId, status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
      include: { disbursements: true },
      orderBy: { requestedAt: 'asc' },
    }),
    prisma.purchase.findMany({
      where: { requisitionId },
      select: { priceMinor: true },
    }),
  ]);

  const approved = req
    .filter(r => r.status === 'APPROVED')
    .reduce((n, r) => n + Number(r.amountMinor), 0);

  const disbursed = req.reduce(
    (n, r) => n + r.disbursements.reduce((m, d) => m + Number(d.amountMinor), 0),
    0,
  );

  const spent = purchases.reduce((n, p) => n + Number(p.priceMinor), 0);

  return { approved, disbursed, spent, requests: req };
}

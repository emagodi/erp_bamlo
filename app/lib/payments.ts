import { prisma } from '@/lib/db';
import { fromMinor, toBigIntMinor } from '@/helpers/money';

export async function getQuoteGrandTotalMinor(projectId: string): Promise<bigint> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: { quote: { select: { metaJson: true } } },
  });
  if (!p?.quote?.metaJson) throw new Error('Quote totals not found');
  const meta = JSON.parse(p.quote.metaJson ?? '{}');
  const totals = meta?.totals;
  if (!totals?.grandTotal) throw new Error('Grand total missing in quote meta');
  return toBigIntMinor(Number(totals.grandTotal));
}

export function addMonths(d: Date, months: number) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt;
}





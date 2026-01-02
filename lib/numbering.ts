import { prisma } from './db';

export async function nextQuoteNumber(date = new Date()): Promise<string> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `QTN-${yyyy}${mm}-`;
  const monthStart = new Date(`${yyyy}-${mm}-01T00:00:00Z`);
  const monthEnd = new Date(`${yyyy}-${mm}-31T23:59:59Z`);

  const latest = await prisma.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
  });
  const lastSeq = latest?.number ? parseInt(latest.number.split('-').pop() || '0', 10) : 0;
  const nextSeq = String(lastSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}


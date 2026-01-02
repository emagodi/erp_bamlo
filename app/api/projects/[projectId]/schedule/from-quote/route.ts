import { NextResponse } from 'next/server';
import { createScheduleFromQuote } from '@/app/(protected)/projects/actions';
import { getCurrentUser } from '@/lib/auth';

export async function POST(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const params = await context.params;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  try {
    const res = await createScheduleFromQuote(params.projectId);
    if (!(res as any).ok) {
      return NextResponse.json({ error: (res as any).error || 'Failed to extract' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, scheduleId: (res as any).scheduleId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to extract' }, { status: 400 });
  }
}

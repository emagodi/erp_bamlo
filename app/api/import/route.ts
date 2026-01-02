import { NextRequest, NextResponse } from 'next/server';
import { upsertFromWorkbook } from '@/lib/excel';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file as any).arrayBuffer) {
    return NextResponse.json({ error: 'file is required (xlsx)' }, { status: 400 });
  }
  const ab = await (file as File).arrayBuffer();
  const buffer = Buffer.from(ab);
  const result = await upsertFromWorkbook(buffer);
  return NextResponse.json(result);
}


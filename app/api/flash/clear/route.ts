import { NextResponse } from 'next/server';

import { clearFlashMessage } from '@/lib/flash.server';

export async function POST() {
  clearFlashMessage();
  return NextResponse.json({ ok: true });
}

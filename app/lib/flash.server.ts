import { cookies } from 'next/headers';

type Flash = { type: 'success' | 'error' | 'info' | 'warning'; message: string };

const KEY = 'app_flash';

export async function setFlashMessage(flash: Flash) {
  const jar = await cookies();
  jar.set(KEY, JSON.stringify(flash), { path: '/', httpOnly: false, maxAge: 10 });
}

export async function readFlashMessage(): Promise<Flash | null> {
  const c = (await cookies()).get(KEY)?.value;
  if (!c) return null;
  try { return JSON.parse(c) as Flash; } catch { return null; }
}

'use server';

import { cookies } from 'next/headers';

import { FLASH_COOKIE, FLASH_COOKIE_OPTIONS, type FlashMessage } from '@/lib/flash';

export async function setFlashMessage(message: FlashMessage): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify(message), FLASH_COOKIE_OPTIONS);
}

export async function readFlashMessage(): Promise<FlashMessage | null> {
  const store = await cookies();
  const value = store.get(FLASH_COOKIE)?.value;
  if (!value) return null;
  try {
    return JSON.parse(value) as FlashMessage;
  } catch {
    return null;
  }
}

export async function clearFlashMessage(): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, '', { ...FLASH_COOKIE_OPTIONS, maxAge: 0 });
}

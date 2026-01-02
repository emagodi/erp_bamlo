export type FlashMessage = { type: 'success' | 'error' | 'info'; message: string };

export const FLASH_COOKIE = 'app_flash';

export const FLASH_COOKIE_OPTIONS = { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 } as const;


'use client';

import { useEffect, useState } from 'react';
import type { FlashMessage } from '@/lib/flash';

const BG_CLASSES: Record<FlashMessage['type'], string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-700',
};

export default function FlashToast({ flash }: { flash: FlashMessage | null }) {
  const [message, setMessage] = useState<FlashMessage | null>(flash);

  useEffect(() => {
    if (flash) setMessage(flash);
  }, [flash]);

  useEffect(() => {
    if (!message) return;
    const controller = new AbortController();
    fetch('/api/flash/clear', { method: 'POST', signal: controller.signal }).catch(() => {});
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [message]);

  if (!message) return null;

  const bg = BG_CLASSES[message.type] ?? BG_CLASSES.info;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`${bg} pointer-events-auto max-w-md rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg`}
        role="status"
        aria-live="assertive"
      >
        {message.message}
      </div>
    </div>
  );
}

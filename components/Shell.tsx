"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const tabs = [
  { label: 'Dashboard', href: '/' },
  { label: 'New Quote', href: '/quotes/new' },
  { label: 'Worksheet', href: '/quotes/new/worksheet' },
  { label: 'Calculator', href: '/quotes/new/calc' },
];

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh grid grid-rows-[auto_auto_1fr]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-blue-600" />
            <div className="font-semibold">Quotation App</div>
          </div>
          <nav className="hidden md:flex items-center gap-3 text-sm">
            <a href="#" className="text-gray-500 hover:text-gray-900">Help</a>
          </nav>
        </div>
      </header>

      {/* Tabs (primary nav) */}
      <div className="bg-gray-50 border-b">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center overflow-x-auto">
            {tabs.map((t) => {
              const active = pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href));
              return (
                <Link key={t.href} href={t.href} className={`px-3 py-2 -mb-px border-b-2 whitespace-nowrap ${active ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}`}>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl w-full p-4">{children}</main>
    </div>
  );
}


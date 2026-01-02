'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import type { AuthenticatedUser } from '@/lib/auth';
import type { QuoteStatus } from '@/lib/workflow';
import { USER_ROLES } from '@/lib/workflow';
import Image from 'next/image';

type NavItem = { label: string; href: string; icon: 'home' | 'quote' | 'sheet' | 'calc' | 'users' | 'clipboard' };

type Role = (typeof USER_ROLES)[number];
type PageDef = NavItem & { roles?: Role[] };

const PAGE_DEFS: PageDef[] = [
  // My Quotes: QS, SENIOR_QS, SALES, ADMIN
  { label: 'My Quotes', href: '/quotes', icon: 'quote', roles: ['QS', 'SENIOR_QS', 'SALES', 'ADMIN'] },
  // New Quote: QS, SENIOR_QS, ADMIN
  { label: 'New Quote', href: '/quotes/new', icon: 'quote', roles: ['QS', 'SENIOR_QS', 'ADMIN'] },
  // Projects: all roles except QS, SENIOR_QS, SALES
  {
    label: 'Projects',
    href: '/projects',
    icon: 'home',
    roles: USER_ROLES.filter((r) => !['QS', 'SENIOR_QS', 'SALES'].includes(r as string)) as Role[],
  },
  // Inventory: PROJECT_MANAGER, PROCUREMENT, SECURITY, ADMIN
  { label: 'Inventory', href: '/inventory', icon: 'sheet', roles: ['PROJECT_MANAGER', 'PROCUREMENT', 'SECURITY', 'ADMIN'] },
  // Assets (multipurpose): Procurement / Security / PM / Admin
  { label: 'Assets', href: '/assets', icon: 'sheet', roles: ['PROCUREMENT', 'SECURITY', 'PROJECT_MANAGER', 'ADMIN'] },
  // Employees: Admin, Managing Director, Project Manager
  { label: 'Employees', href: '/employees', icon: 'users', roles: ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_MANAGER'] },
];

type NotificationItem = {
  id: string;
  number: string | null;
  client: string | null;
  status: QuoteStatus;
};

type NotificationPayload = {
  total: number;
  items: NotificationItem[];
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED_REVIEW: 'Submitted for Review',
  REVIEWED: 'Reviewed',
  SENT_TO_SALES: 'Sent to Sales',
  NEGOTIATION: 'Negotiation',
  FINALIZED: 'Finalized',
  ARCHIVED: 'Archived',
};

function formatRole(role: string | undefined): string {
  if (!role) return 'User';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatQuoteLabel(item: NotificationItem): string {
  return item.number ?? item.id;
}

function Icon({ name, className }: { name: NavItem['icon']; className?: string }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
          />
        </svg>
      );
    case 'quote':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 4h10a2 2 0 0 1 2 2v12l-4-3-4 3V6a2 2 0 0 1 2-2Z"
          />
        </svg>
      );
    case 'sheet':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path strokeWidth="2" d="M3 9h18M9 21V9" />
        </svg>
      );
    case 'calc':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path strokeWidth="2" d="M8 7h8M8 11h8M8 15h4" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0Z" />
          <path strokeWidth="2" d="M9 12h6M9 16h6" />
        </svg>
      );
  }
}

type ThemeMode = 'light' | 'dark' | 'system';

export default function SidebarShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: AuthenticatedUser | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile off-canvas
  const [collapsed, setCollapsed] = useState(false); // desktop collapsed
  const [mode, setMode] = useState<ThemeMode>('system');
  const modeRef = useRef<ThemeMode>('system');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload>({ total: 0, items: [] });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setNotifications({ total: 0, items: [] });
      setLoadingNotifications(false);
      return;
    }
    setLoadingNotifications(true);
    try {
      const response = await fetch('/api/notifications/pending', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }
      const payload = (await response.json()) as NotificationPayload;
      setNotifications({
        total: typeof payload.total === 'number' ? payload.total : (payload.items?.length ?? 0),
        items: Array.isArray(payload.items) ? payload.items : [],
      });
    } catch (error) {
      console.error('[notifications]', error);
      setNotifications({ total: 0, items: [] });
    } finally {
      setLoadingNotifications(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchNotifications().catch(() => {});
  }, [fetchNotifications]);

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications().catch(() => {});
    }
  }, [showNotifications, fetchNotifications]);

  const displayName =
    (currentUser?.name && currentUser.name.trim().length > 0
      ? currentUser.name
      : currentUser?.email) ?? 'Signed user';
  const roleLabel = formatRole(currentUser?.role);
  const officeLabel = currentUser?.office ?? 'Office not set';
  const userInitial =
    (currentUser?.name ?? currentUser?.email ?? '?').trim().charAt(0).toUpperCase() || '?';
  const pendingCount = notifications.total ?? notifications.items.length;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Theme init
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
      setMode(saved);
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = (m: ThemeMode) => {
        const enable = m === 'dark' || (m === 'system' && mq.matches);
        document.documentElement.classList.toggle('dark', enable);
      };
      apply(saved);
      const handler = () => {
        if (modeRef.current === 'system') apply('system');
      };
      mq.addEventListener?.('change', handler);
      return () => mq.removeEventListener?.('change', handler);
    } catch {}
  }, []);

  function applyMode(m: ThemeMode) {
    setMode(m);
    try {
      localStorage.setItem('theme', m);
    } catch {}
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enable = m === 'dark' || (m === 'system' && prefers);
    document.documentElement.classList.toggle('dark', enable);
  }

  // Cycle modes: light -> dark -> system
  function toggleTheme() {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    applyMode(next);
  }
  return (
    <div className="h-dvh overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex h-dvh overflow-hidden">
        {/* Icon rail */}
        <div className="hidden md:flex flex-col items-center gap-4 w-16 bg-barmlo-blue border-r border-barmlo-blue/20 py-4">
          <button
            className="h-10 w-10 rounded-md border border-white/20 bg-white/10 flex flex-col items-center justify-center hover:bg-white/20 text-white"
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setCollapsed((v) => !v);
              } else {
                setOpen((v) => !v);
              }
            }}
            aria-label="Toggle sidebar"
          >
            <span className="block w-5 h-0.5 bg-current" />
            <span className="block w-5 h-0.5 bg-current mt-1.5" />
            <span className="block w-5 h-0.5 bg-current mt-1.5" />
          </button>
          {PAGE_DEFS.filter((p) => !p.roles || p.roles.includes((currentUser?.role as Role) || 'VIEWER')).map((p) => {
            const active = pathname === p.href || (p.href !== '/' && pathname.startsWith(p.href));
            return (
              <Link
                key={'rail-' + p.href}
                href={p.href}
                className={`group relative h-10 w-10 rounded-lg flex items-center justify-center ${active ? 'bg-white/20 text-white' : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon name={p.icon} className="h-5 w-5" />
                {/* Tooltip when sidebar collapsed/hidden */}
                <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Sidebar (collapsible); sticky on desktop so content scrolls independently */}
        <aside
          className={`bg-barmlo-blue border-r border-barmlo-blue/20 transition-all duration-200 ease-in-out w-64
          ${open ? 'translate-x-0' : '-translate-x-full'} block fixed top-0 left-16 h-dvh z-30
          lg:translate-x-0 lg:static lg:block lg:sticky lg:top-0 lg:h-dvh ${collapsed ? 'lg:hidden' : 'lg:block'}`}
        >
          <div className="px-6 py-5 flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-white">
               <Image src="/barmlo_logo.png" alt="Barmlo Logo" fill className="object-contain p-1" />
            </div>
            <span
              className={`text-xl font-bold tracking-tight text-white ${collapsed ? 'hidden lg:inline-block lg:opacity-0 lg:w-0' : 'hidden lg:inline-block'}`}
            >
              Barmlo
            </span>
          </div>
          <div
            className={`px-6 pt-4 text-xs font-semibold text-white/60 tracking-wide ${collapsed ? 'hidden lg:block lg:opacity-0' : ''}`}
          >
            PAGES
          </div>
          <nav className="px-2 py-2 space-y-1">
            {PAGE_DEFS.filter((p) => !p.roles || p.roles.includes((currentUser?.role as Role) || 'VIEWER')).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  <span
                    className={`${collapsed ? 'hidden lg:inline-block lg:opacity-0 lg:w-0' : ''}`}
                  >
                    {item.label}
                  </span>
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-16 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div
            className={`px-6 pt-6 text-xs font-semibold text-white/60 tracking-wide ${collapsed ? 'hidden lg:block lg:opacity-0' : ''}`}
          >
            WIDGETS
          </div>
          <nav className="px-2 py-2 space-y-1">
            <div
              className={`px-4 py-2 text-white/60 text-sm ${collapsed ? 'hidden lg:block lg:opacity-0' : ''}`}
            >
              Cards
            </div>
            <div
              className={`px-4 py-2 text-white/60 text-sm ${collapsed ? 'hidden lg:block lg:opacity-0' : ''}`}
            >
              Banners
            </div>
            <div
              className={`px-4 py-2 text-white/60 text-sm ${collapsed ? 'hidden lg:block lg:opacity-0' : ''}`}
            >
              Charts
            </div>
          </nav>
        </aside>

        {/* Scrim for mobile when sidebar open */}
        {open && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main */}
        <div className={`flex-1 grid grid-rows-[auto_1fr] h-dvh min-h-0 relative`}>
          {/* Background Image */}
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
            <Image src="/dashboard_bg.png" alt="" fill className="object-cover" />
          </div>

          {/* Topbar */}
          <header className="bg-barmlo-orange border-b border-white/10 relative z-10">
            <div className="w-full pl-0 pr-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-white">
                <button
                  className="md:hidden"
                  onClick={() => setOpen(true)}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {/* Breadcrumbs or other header content */}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="relative h-9 w-9 rounded-full flex items-center justify-center text-white hover:text-white/80"
                  aria-label="Toggle theme"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                  </svg>
                </button>
                <div
                  className="relative"
                  onMouseEnter={() => setShowNotifications(true)}
                  onMouseLeave={() => setShowNotifications(false)}
                >
                  <button
                    type="button"
                    className="relative h-9 w-9 rounded-full flex items-center justify-center text-white hover:text-white/80"
                    aria-label="Pending quotations"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5" />
                      <path d="M9 21h6" />
                    </svg>
                    {pendingCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] rounded-full bg-white px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-barmlo-orange">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 rounded-xl border bg-white shadow-lg dark:bg-gray-800 dark:border-gray-700">
                      <div className="flex items-center justify-between px-4 py-2 border-b text-sm font-semibold dark:border-gray-700">
                        <span>Pending quotations</span>
                        <button
                          type="button"
                          onClick={() => fetchNotifications().catch(() => {})}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Refresh
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {loadingNotifications ? (
                          <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500 dark:border-t-transparent" />
                            Loading...
                          </div>
                        ) : notifications.items.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                            No quotations need your action.
                          </div>
                        ) : (
                          notifications.items.map((item) => (
                            <Link
                              key={item.id}
                              href={`/quotes/${item.id}`}
                              className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                              onClick={() => setShowNotifications(false)}
                            >
                              <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                                <span>{formatQuoteLabel(item)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {STATUS_LABELS[item.status]}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {item.client ?? 'No client on record'}
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 border-l border-gray-200 pl-3 dark:border-gray-700">
                  <div className="text-right leading-tight">
                    <div className="text-sm font-semibold text-white">
                      {displayName}
                    </div>
                    <div className="text-xs text-white/80">
                      {roleLabel}
                      {currentUser?.office ? ` - ${officeLabel}` : ''}
                    </div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-barmlo-orange">
                    {userInitial}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoggingOut(true);
                      signOut({ callbackUrl: '/login', redirect: true });
                    }}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-2 rounded-md bg-barmlo-green px-3 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-barmlo-green/90 focus:outline-none focus:ring-2 focus:ring-barmlo-green focus:ring-offset-2 focus:ring-offset-barmlo-orange disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut && (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="w-full px-6 md:px-8 pb-6 overflow-y-auto overflow-x-hidden no-scrollbar min-h-0 relative z-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

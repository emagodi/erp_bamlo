import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

const BASE: { label:string; href:string; icon:string; roles?: string[] }[] = [
  { label: 'My Quotes', href: '/quotes', icon: 'quote', roles: ['QS','SENIOR_QS','SALES','ADMIN'] },
  { label: 'Projects', href: '/projects', icon: 'folder', roles: ['ADMIN','CLIENT','VIEWER','PROJECT_MANAGER','PROCUREMENT','SECURITY','ACCOUNTS','CASHIER','ACCOUNTING_OFFICER','ACCOUNTING_AUDITOR','ACCOUNTING_CLERK','DRIVER','GENERAL_MANAGER','MANAGING_DIRECTOR'] },
  { label: 'New Quote', href: '/quotes/new', icon: 'quote', roles: ['QS','SENIOR_QS','ADMIN'] },
  { label: 'Requisitions', href: '/procurement/requisitions', icon: 'list', roles: ['PROJECT_MANAGER','PROCUREMENT','ADMIN'] },
  { label: 'Purchase Orders', href: '/accounts/po', icon: 'list', roles: ['ACCOUNTS','ACCOUNTING_CLERK','ACCOUNTING_OFFICER','ADMIN'] },
  { label: 'Dispatches', href: '/dispatches', icon: 'truck', roles: ['PROJECT_MANAGER','SECURITY','ADMIN'] },
  { label: 'Funds', href: '/funds', icon: 'bank', roles: ['ACCOUNTS','ACCOUNTING_CLERK','ACCOUNTING_OFFICER','ACCOUNTING_AUDITOR','ADMIN'] },
  { label: 'Inventory', href: '/inventory', icon: 'boxes', roles: ['PROCUREMENT','PROJECT_MANAGER','ADMIN'] },
  { label: 'Audit Logs', href: '/audit-logs', icon: 'list', roles: ['ADMIN'] },
  { label: 'Employees', href: '/employees', icon: 'list', roles: ['ADMIN','MANAGING_DIRECTOR'] },
];

export default async function Sidebar() {
  const me = await getCurrentUser();
  const role = (me?.role ?? 'VIEWER') as string;
  const pathname = usePathname();
  const pages = BASE.filter(p => !p.roles || p.roles.includes(role));

  return (
    <nav className="flex flex-col gap-2 p-2">
      {pages.map(p => {
        const active = pathname === p.href || (p.href !== '/' && pathname.startsWith(p.href));
        return (
          <Link key={p.href} href={p.href} className={`px-3 py-2 rounded ${active ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

import { 
  BanknotesIcon, 
  ClockIcon, 
  UserGroupIcon, 
  InboxIcon 
} from '@heroicons/react/24/outline';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function StatsCards({
  role,
  totalRevenue,
  activeCustomers,
  pendingQuotes,
  totalQuotes,
  pendingProjects,
  totalProjects,
}: {
  role: string;
  totalRevenue: number;
  activeCustomers: number;
  pendingQuotes: number;
  totalQuotes: number;
  pendingProjects: number;
  totalProjects: number;
}) {
  const isMDOrAdmin = role === 'MANAGING_DIRECTOR' || role === 'ADMIN';
  const isAccounts = role === 'ACCOUNTS' || role === 'SALES_ACCOUNTS' || role.startsWith('ACCOUNTING') || role === 'CASHIER';
  const isQuotationRole = ['QS', 'SENIOR_QS', 'SALES'].includes(role);

  const showRevenueAndCustomers = isMDOrAdmin || isAccounts;
  const showPending = !isMDOrAdmin;

  const stats = [];

  if (showRevenueAndCustomers) {
    stats.push({ 
      name: 'Total Revenue', 
      value: `$${totalRevenue.toLocaleString()}`, 
      icon: BanknotesIcon 
    });
  }

  if (showPending) {
    stats.push({ 
      name: isQuotationRole ? 'Pending Quotations' : 'Pending Projects', 
      value: isQuotationRole ? pendingQuotes : pendingProjects, 
      icon: ClockIcon 
    });
  }

  if (showRevenueAndCustomers) {
    stats.push({ 
      name: 'Active Customers', 
      value: activeCustomers, 
      icon: UserGroupIcon 
    });
  }

  stats.push({ 
    name: isQuotationRole ? 'Total Quotations' : 'Total Projects', 
    value: isQuotationRole ? totalQuotes : totalProjects, 
    icon: InboxIcon 
  });

  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-${stats.length}`}>
      {stats.map((item) => (
        <div
          key={item.name}
          className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 sm:px-6 sm:pt-6"
        >
          <dt>
            <div className="absolute rounded-md bg-barmlo-blue p-3">
              <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
          </dd>
        </div>
      ))}
    </div>
  );
}

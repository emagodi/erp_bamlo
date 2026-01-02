import Hero from '@/app/ui/landing/hero';
import { DocumentTextIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const features = [
  {
    name: 'Smart Quotations',
    description: 'Create professional quotes in seconds with our automated tools and templates.',
    icon: DocumentTextIcon,
  },
  {
    name: 'Real-time Analytics',
    description: 'Track your sales performance and revenue with interactive dashboards.',
    icon: ChartBarIcon,
  },
  {
    name: 'Secure & Auditable',
    description: 'Enterprise-grade security with full audit trails for every action.',
    icon: ShieldCheckIcon,
  },
];

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Faster Workflow</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to manage quotes
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Bamlo Quotation Generator provides a comprehensive suite of tools to streamline your sales process, from initial quote to final approval.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
              {features.map((feature) => (
                <div key={feature.name} className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-gray-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                      <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
}

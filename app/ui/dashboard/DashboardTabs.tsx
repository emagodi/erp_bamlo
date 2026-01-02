'use client';

import { useState } from 'react';
import clsx from 'clsx';

export type DashboardTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export default function DashboardTabs({
  tabs,
}: {
  tabs: DashboardTab[];
}) {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '');

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={clsx(
                activeTabId === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} className={clsx(activeTabId === tab.id ? 'block' : 'hidden')}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}

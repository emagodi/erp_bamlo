'use client';

import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
type TaskProgress = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  quantity: number | null;
  unit: string | null;
  totalCompleted: number;
  remaining: number;
  progress: number;
  variance: number;
  isAhead: boolean;
  isBehind: boolean;
  reports: any[];
  assignees: any[];
};

export default function ExcelExportButton({
  tasks,
  projectName,
}: {
  tasks: TaskProgress[];
  projectName: string;
}) {
  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      
      const data = tasks.map((t) => ({
        Task: t.title,
        Description: t.description || '',
        Status: t.status,
        Unit: t.unit || '',
        'Planned Qty': t.quantity || 0,
        'Completed Qty': t.totalCompleted,
        'Remaining Qty': t.remaining,
        'Progress %': `${t.progress.toFixed(0)}%`,
        Variance: t.variance,
        'Schedule Status': t.isBehind ? 'Behind' : t.isAhead ? 'Ahead' : 'On Track',
        'Last Report': t.reports[0]
          ? new Date(t.reports[0].reportedForDate).toLocaleDateString()
          : '-',
        Workers: t.assignees
          .map((a: any) => [a.givenName, a.surname].filter(Boolean).join(' '))
          .join(', '),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Progress Report');
      XLSX.writeFile(wb, `${projectName}_Progress_Report.xlsx`);
    } catch (error) {
      console.error('Failed to export excel:', error);
      alert('Failed to export Excel file. Please try again.');
    }
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 print:hidden"
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
      Export Excel
    </button>
  );
}

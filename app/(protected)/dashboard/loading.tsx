
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded"></div>
        <div className="mt-2 h-4 w-64 bg-gray-200 rounded"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-gray-50 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-gray-200"></div>
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-6 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <div className="flex space-x-4 border-b border-gray-200 pb-2">
          <div className="h-8 w-24 bg-gray-200 rounded"></div>
          <div className="h-8 w-24 bg-gray-200 rounded"></div>
        </div>
        <div className="h-96 rounded-xl bg-gray-50 border border-gray-100"></div>
      </div>
    </div>
  );
}

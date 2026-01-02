import { Spinner } from './spinner';

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" variant="primary" />
        <p className="text-sm font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
}

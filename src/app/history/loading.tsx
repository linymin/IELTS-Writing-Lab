
import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2"></div>
          <div className="h-4 w-64 bg-slate-100 rounded-lg"></div>
        </div>
        
        {/* Controls Skeleton */}
        <div className="flex gap-3">
          <div className="h-10 w-full md:w-64 bg-slate-100 rounded-lg"></div>
          <div className="h-10 w-32 bg-slate-100 rounded-lg"></div>
        </div>
      </div>

      {/* List Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-6">
            {/* Score Badge */}
            <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0"></div>

            {/* Main Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 bg-slate-100 rounded-full"></div>
                <div className="h-4 w-24 bg-slate-100 rounded-full"></div>
              </div>
              <div className="h-6 w-3/4 bg-slate-100 rounded-lg"></div>
            </div>

            {/* Dimensions */}
            <div className="hidden md:flex gap-3 shrink-0">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex flex-col items-center gap-1 min-w-[32px]">
                  <div className="h-3 w-8 bg-slate-100 rounded"></div>
                  <div className="h-6 w-10 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
            
            {/* Arrow */}
            <div className="w-5 h-5 bg-slate-100 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

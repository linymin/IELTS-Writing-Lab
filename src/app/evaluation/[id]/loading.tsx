
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-1/3 bg-slate-200 rounded-lg mb-4"></div>
        <div className="flex gap-4">
          <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
          <div className="h-6 w-32 bg-slate-100 rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Scores Skeleton */}
        <div className="space-y-6">
          {/* Overall Score Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 h-48">
             <div className="h-full flex flex-col items-center justify-center space-y-4">
               <div className="h-24 w-24 rounded-full bg-slate-100"></div>
               <div className="h-4 w-32 bg-slate-100 rounded"></div>
             </div>
          </div>

          {/* Radar Chart Skeleton */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 h-80">
            <div className="h-full w-full bg-slate-50 rounded-full opacity-50 flex items-center justify-center">
               <div className="h-32 w-32 bg-slate-100 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Feedback Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs Skeleton */}
          <div className="flex gap-4 border-b border-slate-200 pb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-24 bg-slate-100 rounded-lg"></div>
            ))}
          </div>

          {/* Content Area Skeleton */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
            <div className="h-6 w-1/4 bg-slate-200 rounded"></div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-slate-100 rounded"></div>
              <div className="h-4 w-full bg-slate-100 rounded"></div>
              <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-24 bg-slate-50 rounded-xl"></div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

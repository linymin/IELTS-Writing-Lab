'use client';

import { X, TrendingUp, Calendar, FileText, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';
import { EssayGroup } from '@/types/history';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  group: EssayGroup | null;
}

export default function HistoryDrawer({ isOpen, onClose, group }: HistoryDrawerProps) {
  const router = useRouter();

  if (!group) return null;

  // Prepare data for chart (oldest to newest)
  const allVersions = [...group.history, group.latest].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const chartData = allVersions.map(v => ({
    date: new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: v.overall_score,
    fullDate: new Date(v.created_at).toLocaleDateString()
  }));

  // Prepare list for display (newest to oldest)
  const displayList = [group.latest, ...group.history];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 7.5) return "text-emerald-600";
    if (score >= 6.5) return "text-blue-600";
    if (score >= 5.0) return "text-orange-500";
    return "text-red-500";
  };

  const handleCardClick = (evaluationId: string) => {
    router.push(`/evaluation/${evaluationId}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Topic History</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Topic Info */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                group.latest.task_type === 'task1' ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
              )}>
                {group.latest.task_type === 'task1' ? 'Task 1' : 'Task 2'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {allVersions.length} Versions
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-lg leading-snug">
              {group.topic}
            </h3>
          </div>

          {/* Score Progression Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-8">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-blue-600" />
                   <span className="font-bold text-slate-700 text-sm">Score Progression</span>
                </div>
                {allVersions.length > 1 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {(() => {
                        const first = allVersions[0].overall_score;
                        const last = allVersions[allVersions.length - 1].overall_score;
                        const diff = last - first;
                        return diff > 0 ? `+${diff.toFixed(1)} Band` : diff < 0 ? `${diff.toFixed(1)} Band` : 'No Change';
                    })()}
                  </span>
                )}
             </div>
             
             <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis 
                     dataKey="date" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 10, fill: '#94a3b8' }} 
                     dy={10}
                   />
                   <YAxis 
                     domain={[0, 9]} 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 10, fill: '#94a3b8' }} 
                     ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
                   />
                   <Tooltip 
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                     itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}
                   />
                   <Line 
                     type="monotone" 
                     dataKey="score" 
                     stroke="#4f46e5" 
                     strokeWidth={2} 
                     dot={{ fill: '#4f46e5', strokeWidth: 2, r: 4, stroke: '#fff' }} 
                     activeDot={{ r: 6, strokeWidth: 0 }}
                   />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Submission History List */}
          <div>
            <div className="flex items-center gap-2 mb-4">
               <FileText className="w-4 h-4 text-slate-500" />
               <h4 className="font-bold text-slate-700 text-sm">Submission History</h4>
            </div>

            <div className="space-y-4">
              {displayList.map((version, index) => (
                <div 
                  key={version.id}
                  className={cn(
                    "bg-white rounded-xl border p-4 transition-all hover:shadow-md",
                    index === 0 ? "border-blue-200 shadow-sm ring-1 ring-blue-100" : "border-slate-200 hover:border-blue-200"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Latest
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                           <Calendar className="w-3 h-3" />
                           {formatDate(version.created_at)}
                        </div>
                     </div>
                     
                     <button
                        onClick={() => handleCardClick(version.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
                     >
                        View Report <ArrowRight className="w-3 h-3" />
                     </button>
                  </div>

                  {/* Score Data Panel */}
                  <div className="flex gap-3">
                    {/* Left: Overall Score */}
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg w-16 shrink-0 bg-slate-50">
                       <span className="text-[9px] font-bold text-slate-400 mb-0.5 uppercase">Overall</span>
                       <span className={cn("text-xl font-bold", getScoreColor(version.overall_score))}>
                         {version.overall_score}
                       </span>
                    </div>

                    {/* Right: Dimensions */}
                    <div className="flex-1 grid grid-cols-4 gap-1">
                      {['TR', 'CC', 'LR', 'GRA'].map(dim => {
                        const score = version.dimensions?.[dim as keyof typeof version.dimensions] ?? 0;
                        return (
                          <div key={dim} className="rounded-lg p-1.5 flex flex-col items-center justify-center bg-slate-50">
                            <span className="text-[9px] font-bold text-slate-400 mb-0.5">{dim}</span>
                            <span className={cn("text-sm font-bold", getScoreColor(score))}>
                              {score || '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

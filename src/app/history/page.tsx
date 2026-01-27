'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, 
  Calendar, 
  ChevronRight, 
  FileText,
  ArrowUpDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface EssayRecord {
  id: string; // evaluation id
  essay_id: string;
  topic: string;
  overall_score: number;
  dimensions: {
    TR: number;
    CC: number;
    LR: number;
    GRA: number;
  };
  created_at: string;
  task_type: 'task1' | 'task2';
}

type SortOption = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc';

export default function HistoryPage() {
  const [history, setHistory] = useState<EssayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session, strictly we should redirect or show empty.
        // For this demo context, we just show empty.
        setHistory([]);
        setLoading(false);
        return;
      }

      // Fetch evaluations joined with essays
      // We want all evaluations where the related essay belongs to the user
      // RLS should handle the "belongs to user" part if we filter by user_id in essays,
      // but since we query 'evaluations', the RLS policy on evaluations checks for essay ownership.
      // So simple select should work.
      
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          overall_band,
          band_scores,
          created_at,
          essays!inner (
            id,
            question_text,
            task_type,
            submitted_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData: EssayRecord[] = data.map((item) => {
          // Handle potential array response for joined table
          const essayData = Array.isArray(item.essays) ? item.essays[0] : item.essays;
          
          return {
            id: item.id,
            essay_id: essayData.id,
            topic: essayData.question_text,
            overall_score: Number(item.overall_band),
            dimensions: item.band_scores as unknown as EssayRecord['dimensions'],
            created_at: essayData.submitted_at || item.created_at, // Use submission time preference
            task_type: essayData.task_type
          };
        });
        setHistory(formattedData);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and Sort
  const filteredHistory = history
    .filter(item => 
      item.topic.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'score_desc':
          return b.overall_score - a.overall_score;
        case 'score_asc':
          return a.overall_score - b.overall_score;
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Evaluation History</h1>
          <p className="text-slate-500 mt-1">Review your past essays and track your progress.</p>
        </div>
        
        {/* Controls */}
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
            />
          </div>
          
          <div className="relative">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-50"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="score_desc">Highest Score</option>
              <option value="score_asc">Lowest Score</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredHistory.length > 0 ? (
        <div className="space-y-4">
          {filteredHistory.map((item) => (
            <Link 
              key={item.id} 
              href={`/evaluation/${item.id}`}
              className="block group"
            >
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                {/* Score Badge */}
                <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-lg text-blue-700 shrink-0">
                  <span className="text-2xl font-bold">{item.overall_score}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Band</span>
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      item.task_type === 'task1' ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                    )}>
                      {item.task_type === 'task1' ? 'Task 1' : 'Task 2'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 truncate pr-4 group-hover:text-blue-600 transition-colors">
                    {item.topic}
                  </h3>
                </div>

                {/* Dimensions */}
                <div className="hidden md:flex gap-3 shrink-0">
                  {Object.entries(item.dimensions).map(([key, score]) => (
                    <div key={key} className="flex flex-col items-center gap-1 min-w-[32px]">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{key}</div>
                      <div className={cn(
                        "text-sm font-semibold rounded px-1.5 py-0.5",
                        score >= 7 ? "bg-green-50 text-green-700" : 
                        score >= 6 ? "bg-yellow-50 text-yellow-700" : 
                        "bg-red-50 text-red-700"
                      )}>
                        {score}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No essays found</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? "We couldn't find any essays matching your search." 
              : "You haven't submitted any essays for evaluation yet."}
          </p>
          {searchQuery ? (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-blue-600 font-medium hover:underline"
            >
              Clear search
            </button>
          ) : (
            <Link 
              href="/workshop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Start Your First Essay
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

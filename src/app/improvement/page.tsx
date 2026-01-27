'use client';

import { TrendingUp, ArrowRight, Target, RefreshCw, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
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

interface AverageScores {
  overall: number;
  TR: number;
  CC: number;
  LR: number;
  GRA: number;
}

export default function ImprovementPage() {
  const [targetScore, setTargetScore] = useState<number>(7.0);
  const [essaysToImprove, setEssaysToImprove] = useState<EssayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageScores, setAverageScores] = useState<AverageScores>({
    overall: 0,
    TR: 0,
    CC: 0,
    LR: 0,
    GRA: 0
  });

  useEffect(() => {
    // 1. Load Target Score
    const savedScore = localStorage.getItem('ielts_target_score');
    const score = savedScore ? parseFloat(savedScore) : 7.0;
    setTargetScore(score);

    // 2. Fetch Data
    fetchEssaysToImprove(score);
  }, []);

  const fetchEssaysToImprove = async (target: number) => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      // Fetch evaluations
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
          const essayData = Array.isArray(item.essays) ? item.essays[0] : item.essays;
          return {
            id: item.id,
            essay_id: essayData.id,
            topic: essayData.question_text,
            overall_score: Number(item.overall_band),
            dimensions: item.band_scores as unknown as EssayRecord['dimensions'],
            created_at: essayData.submitted_at || item.created_at,
            task_type: essayData.task_type
          };
        });

        // Calculate Averages (using all data, not just filtered)
        if (formattedData.length > 0) {
          const sums = formattedData.reduce((acc, curr) => ({
            overall: acc.overall + curr.overall_score,
            TR: acc.TR + (curr.dimensions?.TR || 0),
            CC: acc.CC + (curr.dimensions?.CC || 0),
            LR: acc.LR + (curr.dimensions?.LR || 0),
            GRA: acc.GRA + (curr.dimensions?.GRA || 0),
          }), { overall: 0, TR: 0, CC: 0, LR: 0, GRA: 0 });

          const count = formattedData.length;
          setAverageScores({
            overall: parseFloat((sums.overall / count).toFixed(1)),
            TR: parseFloat((sums.TR / count).toFixed(1)),
            CC: parseFloat((sums.CC / count).toFixed(1)),
            LR: parseFloat((sums.LR / count).toFixed(1)),
            GRA: parseFloat((sums.GRA / count).toFixed(1)),
          });
        }

        // Filter by Target Score for the list
        const toImprove = formattedData.filter(essay => essay.overall_score < target);
        setEssaysToImprove(toImprove);
      }
    } catch (error) {
      console.error('Error fetching improvement essays:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-blue-600" />
        Practical Review Center
      </h1>
      
      {/* Header: Target & Current Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Target Score */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 text-blue-100 mb-1">
              <Target className="w-4 h-4" />
              <span className="font-medium text-sm uppercase tracking-wider">Target Goal</span>
            </div>
            <div className="text-4xl font-bold mb-2">Band {targetScore}</div>
            <Link 
              href="/settings"
              className="inline-flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors backdrop-blur-sm"
            >
              Adjust Goal <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Divider (Desktop) */}
          <div className="hidden md:block w-px h-24 bg-white/20" />

          {/* Right: Current Averages */}
          <div className="flex-1">
            <div className="flex items-center gap-2 text-blue-100 mb-4">
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium text-sm uppercase tracking-wider">Your Current Average</span>
            </div>
            
            <div className="flex items-end gap-6">
               <div className="flex flex-col">
                  <span className="text-3xl font-bold">{averageScores.overall}</span>
                  <span className="text-xs text-blue-100 font-medium uppercase mt-1">Overall</span>
               </div>
               
               <div className="flex-1 grid grid-cols-4 gap-2">
                  <div className="bg-white/10 rounded-lg p-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold">{averageScores.TR}</div>
                    <div className="text-[10px] text-blue-100 font-bold">TR</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold">{averageScores.CC}</div>
                    <div className="text-[10px] text-blue-100 font-bold">CC</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold">{averageScores.LR}</div>
                    <div className="text-[10px] text-blue-100 font-bold">LR</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold">{averageScores.GRA}</div>
                    <div className="text-[10px] text-blue-100 font-bold">GRA</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rewrite Workbench */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Rewrite Workbench</h2>
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {essaysToImprove.length} Pending
          </span>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : essaysToImprove.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {essaysToImprove.map((essay) => (
              <div key={essay.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    essay.task_type === 'task1' ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                  )}>
                    {essay.task_type === 'task1' ? 'Task 1' : 'Task 2'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDate(essay.created_at)}
                  </span>
                </div>

                {/* Content */}
                <h3 className="font-semibold text-slate-900 mb-4 line-clamp-2 min-h-[3rem]">
                  {essay.topic}
                </h3>

                {/* Score Grid (Replacing Target/Gap) */}
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                     <span className="text-xs font-bold text-slate-500 uppercase">Overall Band</span>
                     <span className="text-lg font-bold text-red-600">{essay.overall_score}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">TR</div>
                      <div className="text-sm font-semibold text-slate-700">{essay.dimensions?.TR ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">CC</div>
                      <div className="text-sm font-semibold text-slate-700">{essay.dimensions?.CC ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">LR</div>
                      <div className="text-sm font-semibold text-slate-700">{essay.dimensions?.LR ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">GRA</div>
                      <div className="text-sm font-semibold text-slate-700">{essay.dimensions?.GRA ?? '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="mt-auto">
                  <Link 
                    href={`/evaluation/${essay.id}/rewrite`} 
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 font-medium py-2 rounded-lg transition-all group"
                  >
                    Start Rewrite
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">All Caught Up!</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-4">
              Great job! All your recent essays meet or exceed your target score of {targetScore}.
            </p>
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline"
            >
              Write a new essay <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

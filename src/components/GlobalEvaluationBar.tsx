'use client';

import { useEvaluation } from '@/lib/context/evaluation-context';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn utility exists, else I'll use template literals

export function GlobalEvaluationBar() {
  const { isEvaluating, progress, isComplete, currentStage } = useEvaluation();
  const pathname = usePathname();
  const router = useRouter();

  // Don't show if not evaluating (or complete but result not viewed yet)
  // Also don't show on the evaluating page itself
  if ((!isEvaluating && !isComplete) || pathname === '/evaluating') {
    return null;
  }

  // If complete, but we haven't viewed report (isEvaluating might be false but isComplete true? 
  // In context: resetEvaluation sets both to false. So isComplete stays true until viewed.)
  
  return (
    <div 
      onClick={() => router.push('/evaluating')}
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] cursor-pointer shadow-md transition-all duration-300 transform translate-y-0",
        isComplete ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between text-white">
        
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle className="w-5 h-5 animate-pulse" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-blue-200" />
          )}
          <span className="font-medium text-sm truncate max-w-md">
            {isComplete ? "Evaluation Complete! Click to view report." : currentStage}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {!isComplete && (
            <div className="text-xs font-mono text-blue-100 bg-blue-800/50 px-2 py-1 rounded">
              {Math.round(progress)}%
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-white/70" />
        </div>
      </div>

      {/* Progress Line */}
      {!isComplete && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-800 w-full">
           <div 
             className="h-full bg-white/30 transition-all duration-1000 ease-linear" 
             style={{ width: `${progress}%` }}
           />
        </div>
      )}
    </div>
  );
}

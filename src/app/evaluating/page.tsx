'use client';

import { useEvaluation } from '@/lib/context/evaluation-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft, Minimize2, CheckCircle, Search, Brain, PenTool, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { 
    id: 'structure', 
    label: 'Parsing structure', 
    subLabel: 'Analyzing paragraph organization',
    icon: Search,
    range: [0, 30] 
  },
  { 
    id: 'grading', 
    label: 'Grading dimensions', 
    subLabel: 'Evaluating TR, CC, LR, GRA',
    icon: Brain,
    range: [30, 120] 
  },
  { 
    id: 'feedback', 
    label: 'Drafting feedback', 
    subLabel: 'Generating personalized suggestions',
    icon: PenTool,
    range: [120, 240] 
  },
  { 
    id: 'report', 
    label: 'Finalizing report', 
    subLabel: 'Compiling results & history',
    icon: FileText,
    range: [240, 300] 
  }
];

export default function EvaluatingPage() {
  const router = useRouter();
  const { 
    isEvaluating, 
    elapsedSeconds, 
    timeLeft, 
    isComplete, 
    navigateToReport,
    evaluationId,
    cancelEvaluation
  } = useEvaluation();

  // Redirect if not evaluating and no result pending
  useEffect(() => {
    if (!isEvaluating && !evaluationId) {
      router.push('/workshop');
    }
  }, [isEvaluating, evaluationId, router]);

  // Auto-redirect on completion
  useEffect(() => {
    if (isComplete && evaluationId) {
       // Short delay to show 100% state briefly
       const timer = setTimeout(() => {
          navigateToReport();
       }, 800);
       return () => clearTimeout(timer);
    }
  }, [isComplete, evaluationId, navigateToReport]);

  const getCurrentStepIndex = () => {
    if (isComplete) return STEPS.length; // All complete
    const step = STEPS.findIndex(s => elapsedSeconds < s.range[1]);
    return step === -1 ? STEPS.length - 1 : step;
  };

  const activeStepIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden font-sans text-slate-900">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <button 
           onClick={() => router.back()}
           className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        
        <button 
           onClick={() => router.back()} 
           className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 flex items-center gap-2"
        >
          <span className="text-sm font-medium">Run in Background</span>
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Card - Clean White Style */}
      <div className="z-10 w-full max-w-md px-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 relative overflow-hidden">
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
            {isComplete ? "Evaluation Complete!" : "Evaluating Essay"}
          </h1>
          <p className="text-slate-500 text-sm text-center mb-8">
             {isComplete ? "Redirecting to your report..." : "Please wait while our AI analyzes your writing."}
          </p>

          {/* Steps List */}
          <div className="space-y-6 relative">
            {/* Connecting Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100 z-0" />

            {STEPS.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isFinished = index < activeStepIndex;
              const isPending = index > activeStepIndex;

              return (
                <div 
                  key={step.id} 
                  className={cn(
                    "relative flex items-center gap-4 transition-all duration-500 z-10",
                    isPending ? "opacity-40 grayscale" : "opacity-100"
                  )}
                >
                  {/* Icon Circle */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300",
                    isFinished ? "bg-green-50 border-green-200 text-green-600" :
                    isActive ? "bg-blue-50 border-blue-200 text-blue-600" :
                    "bg-white border-slate-200 text-slate-300"
                  )}>
                    {isFinished ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pt-1">
                    <h3 className={cn(
                      "text-base font-medium leading-none mb-1 transition-colors",
                      isActive ? "text-slate-900" : "text-slate-500"
                    )}>
                      {step.label}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {step.subLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timer (Subtle) */}
          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
              Estimated Time Remaining
            </p>
            <div className="text-2xl font-mono font-bold text-slate-700">
               {isComplete ? (
                 <span className="text-green-600">0s</span>
               ) : (
                 <span>{Math.ceil(timeLeft)}s</span>
               )}
            </div>
          </div>
          
        </div>

        {/* Cancel Button */}
        {!isComplete && (
           <div className="mt-6 text-center">
             <button 
               onClick={cancelEvaluation}
               className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors px-4 py-2"
             >
               Cancel Evaluation
             </button>
           </div>
        )}
      </div>
    </div>
  );
}

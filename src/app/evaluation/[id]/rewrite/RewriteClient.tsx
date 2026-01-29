'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { IELTSReport } from '@/types/evaluation';
import EvaluationReportSimplified from '@/components/EvaluationReportSimplified';
import { Save, Send, Loader2, ArrowLeft, Maximize2, Minimize2, Lightbulb, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// Define schema for streaming feedback
const feedbackSchema = z.object({
  overallScore: z.number().optional(),
  dimensions: z.object({
    taskResponse: z.object({ score: z.number().optional() }).optional(),
    coherenceCohesion: z.object({ score: z.number().optional() }).optional(),
    lexicalResource: z.object({ score: z.number().optional() }).optional(),
    grammaticalRangeAccuracy: z.object({ score: z.number().optional() }).optional(),
  }).optional(),
}).passthrough();

interface RewriteClientProps {
  originalEssayBody: string;
  originalReport: IELTSReport;
  questionText: string;
  taskType: 'task1' | 'task2';
  evaluationId: string;
}

export default function RewriteClient({
  originalEssayBody,
  originalReport,
  questionText,
  taskType,
  evaluationId
}: RewriteClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [essayContent, setEssayContent] = useState(originalEssayBody);
  const [focusMode, setFocusMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const wordCount = essayContent.trim().split(/\s+/).filter(w => w.length > 0).length;

  // Streaming Object Hook
  const { object: streamingResult, submit, isLoading, error: streamError } = useObject({
    api: '/api/evaluate',
    schema: feedbackSchema,
    headers: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        return { 'Authorization': `Bearer ${token}` } as Record<string, string>;
      }
      return {} as Record<string, string>;
    },
    onFinish: async ({ object, error }) => {
       if (error) {
         setError("Evaluation failed: " + error.message);
         return;
       }
       
       setIsRedirecting(true);

       // Poll for the saved ID in Supabase
       const checkSaved = async (attempts = 0) => {
         // Increase attempts to 60 (approx 60 seconds) to allow for slow background saves
         if (attempts > 60) {
           setError("Evaluation saved, but could not retrieve ID. Please check your history.");
           return;
         }
         
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) return;

         const { data, error } = await supabase
           .from('essays')
           .select('evaluations(id)')
           .eq('user_id', user.id)
           .order('submitted_at', { ascending: false })
           .limit(1)
           .single();

         if (data?.evaluations?.[0]?.id) {
           router.push(`/evaluation/${data.evaluations[0].id}`);
         } else {
           setTimeout(() => checkSaved(attempts + 1), 1000);
         }
       };
       
       await checkSaved();
    }
  });

  // Safe access to streaming data
  // @ts-ignore
  const currentResult = streamingResult as any;

  const lowestDimension = useMemo(() => {
    const dims = originalReport.dimensions;
    const scores = [
      { key: 'Task Response', val: dims.taskResponse.score },
      { key: 'Coherence & Cohesion', val: dims.coherenceCohesion.score },
      { key: 'Lexical Resource', val: dims.lexicalResource.score },
      { key: 'Grammatical Range & Accuracy', val: dims.grammaticalRangeAccuracy.score }
    ];
    const minVal = Math.min(...scores.map(s => s.val));
    const lowest = scores.filter(s => s.val === minVal);
    return lowest[0]?.key || 'General Improvement';
  }, [originalReport]);

  const handleSaveDraft = () => {
    alert("Draft saved locally! (Feature coming soon)");
    localStorage.setItem(`draft_${evaluationId}`, essayContent);
  };

  const handleSubmit = async () => {
    if (!essayContent.trim()) return;
    if (essayContent.length < 50) {
      alert("Essay is too short (minimum 50 characters).");
      return;
    }

    setError(null);
    
    try {
      // 1. Check Auth first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to submit a rewrite.");
      }

      // 2. Submit using streaming hook
      submit({
        essay_body: essayContent,
        task_type: taskType,
        question_text: questionText,
      });

    } catch (error) {
      console.error("Submission error:", error);
      setError(error instanceof Error ? error.message : "Failed to submit for evaluation.");
    }
  };

  if (isLoading || isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center max-w-lg w-full">
           <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center">
             <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing your Rewrite...</h2>
           
           {currentResult ? (
             <div className="text-left mt-6 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
               <div className="space-y-1 text-sm text-slate-500">
                 <div className="flex justify-between">
                   <span>Task Response:</span>
                   <span className={currentResult.dimensions?.taskResponse?.score ? "text-green-600 font-bold" : "text-slate-300"}>
                     {currentResult.dimensions?.taskResponse?.score || 'Pending...'}
                   </span>
                 </div>
                 <div className="flex justify-between">
                   <span>Coherence & Cohesion:</span>
                   <span className={currentResult.dimensions?.coherenceCohesion?.score ? "text-green-600 font-bold" : "text-slate-300"}>
                     {currentResult.dimensions?.coherenceCohesion?.score || 'Pending...'}
                   </span>
                 </div>
                 <div className="flex justify-between">
                   <span>Lexical Resource:</span>
                   <span className={currentResult.dimensions?.lexicalResource?.score ? "text-green-600 font-bold" : "text-slate-300"}>
                     {currentResult.dimensions?.lexicalResource?.score || 'Pending...'}
                   </span>
                 </div>
                 <div className="flex justify-between">
                   <span>Grammar:</span>
                   <span className={currentResult.dimensions?.grammaticalRangeAccuracy?.score ? "text-green-600 font-bold" : "text-slate-300"}>
                     {currentResult.dimensions?.grammaticalRangeAccuracy?.score || 'Pending...'}
                   </span>
                 </div>
               </div>

               <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                 <span className="text-slate-900 font-medium">Overall Score:</span>
                 <span className={cn(
                    "font-bold text-lg", 
                    currentResult.overallScore ? "text-blue-600" : "text-slate-400 text-sm font-normal"
                 )}>
                   {currentResult.overallScore ? currentResult.overallScore : 'Calculating...'}
                 </span>
               </div>
             </div>
           ) : (
             <p className="text-slate-500 mb-8">Connecting to AI examiner...</p>
           )}

           <p className="text-xs text-slate-400 mt-6">This may take up to 30 seconds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Left Panel: Feedback & Reference */}
      <div 
        className={cn(
          "h-full flex flex-col border-r border-slate-200 bg-white overflow-hidden transition-all duration-300 ease-in-out",
          focusMode ? "w-0 opacity-0 border-r-0" : "w-1/2 opacity-100"
        )}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <Link href={`/evaluation/${evaluationId}`} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 mb-2">
             <ArrowLeft className="w-4 h-4" /> Back to Report
           </Link>
           <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Original Prompt</h2>
           <p className="text-slate-900 mt-1 text-sm leading-relaxed max-h-24 overflow-y-auto">
             {questionText}
           </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
           <div className="mb-4">
             <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mb-2">
               Previous Feedback
             </span>
             <p className="text-slate-500 text-xs mb-4">
               Review the feedback below to improve your score in the next version.
             </p>
           </div>
           
           <EvaluationReportSimplified 
             result={originalReport} 
             essay={originalEssayBody} 
             mode="rewrite"
           />
        </div>
      </div>

      {/* Right Panel: Writing Area */}
      <div className={cn(
        "h-full flex flex-col bg-slate-100 transition-all duration-300 ease-in-out",
        focusMode ? "w-full" : "w-1/2"
      )}>
        {/* Toolbar */}
        <div className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setFocusMode(!focusMode)}
               className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-2 text-sm font-medium"
               title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
             >
               {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
               {focusMode ? "Exit Focus" : "Focus Mode"}
             </button>
             <div className="h-4 w-px bg-slate-200" />
             <h1 className="text-slate-900 font-bold truncate max-w-md text-sm">Version 2 (Improvement)</h1>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
             <span className={wordCount < 250 ? "text-orange-500 font-medium" : "text-emerald-600 font-medium"}>
               {wordCount} words
             </span>
             {wordCount < 250 && (
               <span className="hidden sm:inline text-slate-400">
                 (Min 250)
               </span>
             )}
          </div>
        </div>
        
        {/* Priority Tip Banner */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-sm">
           <div className="bg-amber-100 p-2 rounded-full shrink-0">
             <Lightbulb className="w-5 h-5 text-amber-600" />
           </div>
           <div>
             <p className="text-sm text-amber-900 font-medium leading-snug">
               <span className="font-bold uppercase tracking-wide text-xs text-amber-700 block mb-0.5">Priority Focus</span>
               Based on your previous score, pay special attention to <span className="font-bold underline decoration-amber-400 decoration-2 underline-offset-2">{lowestDimension}</span> in this version.
             </p>
           </div>
        </div>

        {/* Editor Area - Maximized */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col relative">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              className="flex-1 w-full h-full p-8 text-lg leading-loose text-slate-800 resize-none outline-none font-serif placeholder:text-slate-300 custom-scrollbar"
              placeholder="Start writing your improved version here..."
              value={essayContent}
              onChange={(e) => setEssayContent(e.target.value)}
              spellCheck={false}
            />
            
            {/* Bottom Actions Bar (Overlay or Sticky Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-10 flex justify-end items-center gap-3">
               <span className="text-xs text-slate-400 mr-auto pl-2">
                 {essayContent !== originalEssayBody ? 'Unsaved changes' : 'All saved'}
               </span>

               <button 
                 onClick={handleSaveDraft}
                 className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium shadow-sm"
                 disabled={isLoading}
               >
                 <Save className="w-4 h-4" /> Save Draft
               </button>
               <button 
                 onClick={handleSubmit}
                 disabled={isLoading}
                 className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isLoading ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                   </>
                 ) : (
                   <>
                     <Send className="w-4 h-4" /> Submit Rewrite
                   </>
                 )}
               </button>
            </div>
          </div>
        </div>

        {/* Error Toast (Simple) */}
        {error && (
          <div className="absolute bottom-20 right-6 max-w-sm bg-red-50 text-red-600 border border-red-100 p-4 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-right">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
               <h4 className="font-bold text-sm">Submission Error</h4>
               <p className="text-xs mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useEvaluationPoller } from '@/hooks/useEvaluationPoller';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Define schema (can be loose since we don't display detailed data here, but needed for useObject)
const feedbackSchema = z.object({
  overallScore: z.number().optional(),
  dimensions: z.object({
    taskResponse: z.object({ score: z.number().optional() }).optional(),
    coherenceCohesion: z.object({ score: z.number().optional() }).optional(),
    lexicalResource: z.object({ score: z.number().optional() }).optional(),
    grammaticalRangeAccuracy: z.object({ score: z.number().optional() }).optional(),
  }).optional(),
}).passthrough();

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = searchParams.get('key');
  const supabase = createClient();
  const { pollForEvaluationId } = useEvaluationPoller();
  
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Initializing...");
  const hasSubmitted = useRef(false);

  // useObject hook for robust streaming
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
            setError("Evaluation stream failed: " + error.message);
            return;
        }
        
        setStatusText("Finalizing report...");
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");
            
            // Poll for the saved evaluation ID using shared hook
            const newEvalId = await pollForEvaluationId(user.id);
            if (newEvalId) {
                // Success! Clear storage and redirect
                if (storageKey) sessionStorage.removeItem(storageKey);
                router.replace(`/evaluation/${newEvalId}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to retrieve evaluation result.");
        }
    }
  });

  // Trigger Submission
  useEffect(() => {
    if (hasSubmitted.current) return;

    const initSubmission = async () => {
        hasSubmitted.current = true; // Prevent double submission
        
        if (!storageKey) {
            setError("Missing evaluation data key.");
            return;
        }

        const rawData = sessionStorage.getItem(storageKey);
        if (!rawData) {
            setError("Evaluation data not found or expired. Please try submitting again.");
            return;
        }

        let payload;
        try {
            payload = JSON.parse(rawData);
        } catch (e) {
            setError("Invalid data format.");
            return;
        }
        
        setStatusText("Connecting to AI examiner...");
        // Initiate streaming submission
        submit(payload);
    };

    // Small delay to ensure hydration
    const timer = setTimeout(initSubmission, 500);
    return () => clearTimeout(timer);
  }, [storageKey, submit]);

  // Safe access to streaming data
  // @ts-ignore - The object shape is inferred loosely but we know it matches the schema
  const currentResult = streamingResult as any;

  if (error || streamError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-md w-full">
           <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
             <AlertTriangle className="w-8 h-8 text-red-600" />
           </div>
           <h2 className="text-xl font-bold text-slate-900 mb-2">Evaluation Failed</h2>
           <p className="text-slate-500 mb-6">{error || streamError?.message}</p>
           <button 
             onClick={() => router.back()}
             className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
           >
             Go Back
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center max-w-lg w-full animate-in fade-in zoom-in-95 duration-300">
         <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center relative">
           <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
         </div>
         
         <h2 className="text-2xl font-bold text-slate-900 mb-2">Evaluating your Rewrite...</h2>
         <p className="text-slate-500 mb-8 min-h-[1.5rem] transition-all duration-300">
            {currentResult ? "Generating detailed feedback..." : statusText}
         </p>
         
         {/* Real-time Streaming Feedback */}
         {currentResult ? (
           <div className="text-left mt-6 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100 animate-in slide-in-from-bottom-2 fade-in duration-500">
             {/* Show dimensions as they appear */}
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

             {/* Overall Score at the bottom */}
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
           <div className="max-w-md mx-auto">
             <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-64 mx-auto">
                <div className="h-full bg-slate-200 animate-pulse rounded-full w-full"></div>
             </div>
             <p className="text-xs text-slate-400 mt-3">Connecting to AI examiner...</p>
           </div>
         )}
         
         <p className="text-xs text-slate-400 mt-6">This may take up to 30 seconds.</p>
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <ProcessingContent />
    </Suspense>
  );
}

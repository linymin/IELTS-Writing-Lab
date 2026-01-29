'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';

// Define schema for UI feedback (same as Workshop)
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
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Initializing...");
  const [hasStarted, setHasStarted] = useState(false);

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
    onFinish: async ({ object, error }: { object?: any, error?: Error }) => {
       if (error) {
         setError("Evaluation failed: " + error.message);
         return;
       }
       
       // Poll for the saved ID in Supabase
       let attempts = 0;
       const checkSaved = async () => {
         // Increased timeout and max attempts for slower backend processing
         if (attempts > 30) { 
           setError("Evaluation saved, but could not retrieve ID. Please check your history.");
           return;
         }
         attempts++;
         
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) return;

         // We need to match the specific rewrite essay we just submitted.
         // Since we don't have the new essay ID returned by the stream yet (it's async),
         // we rely on finding the LATEST submission by this user.
         // This is generally safe for a single user session.
         const { data } = await supabase
           .from('essays')
           .select('evaluations(id)')
           .eq('user_id', user.id)
           .order('submitted_at', { ascending: false })
           .limit(1)
           .single();

         if (data?.evaluations?.[0]?.id) {
           // Clear storage and redirect
           if (storageKey) sessionStorage.removeItem(storageKey);
           router.replace(`/evaluation/${data.evaluations[0].id}`);
         } else {
           setTimeout(checkSaved, 2000); // Poll every 2 seconds
         }
       };
       
       await checkSaved();
    }
  });

  // Simulated progress
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= 90) return prev + 0.1;
        if (prev >= 60) return prev + 0.5;
        return prev + 2;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Update status text
  useEffect(() => {
    if (loadingStep < 30) setStatusText("Analyzing essay structure...");
    else if (loadingStep < 60) setStatusText("Checking grammar and vocabulary...");
    else if (loadingStep < 90) setStatusText("Generating scoring and feedback...");
    else setStatusText("Finalizing report...");
  }, [loadingStep]);

  // Trigger submission
  useEffect(() => {
    const startProcess = async () => {
      if (hasStarted) return;
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

      setHasStarted(true);
      submit(payload);
    };

    // Small delay to ensure UI renders first
    const timer = setTimeout(() => {
      startProcess();
    }, 500);

    return () => clearTimeout(timer);
  }, [storageKey, hasStarted, submit]);


  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-md w-full">
           <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
             <AlertTriangle className="w-8 h-8 text-red-600" />
           </div>
           <h2 className="text-xl font-bold text-slate-900 mb-2">Evaluation Failed</h2>
           <p className="text-slate-500 mb-6">{error}</p>
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
         <p className="text-slate-500 mb-8 min-h-[1.5rem] transition-all duration-300">{statusText}</p>
         
         <div className="max-w-md mx-auto">
           <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="h-full bg-blue-600 transition-all duration-300 ease-out" 
               style={{ width: `${Math.min(loadingStep, 100)}%` }}
             ></div>
           </div>
           <div className="flex justify-between mt-3 text-xs text-slate-400 font-medium">
             <span className={loadingStep > 10 ? "text-blue-600 transition-colors" : ""}>Structure</span>
             <span className={loadingStep > 40 ? "text-blue-600 transition-colors" : ""}>Grammar</span>
             <span className={loadingStep > 70 ? "text-blue-600 transition-colors" : ""}>Cohesion</span>
             <span className={loadingStep > 90 ? "text-blue-600 transition-colors" : ""}>Scoring</span>
           </div>
         </div>
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

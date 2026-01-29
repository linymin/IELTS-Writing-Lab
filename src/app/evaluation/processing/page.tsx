'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = searchParams.get('key');
  const supabase = createClient();
  
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Initializing...");

  // Simulated progress
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        // Slow down as we get closer to 90%
        if (prev >= 90) return prev + 0.1;
        if (prev >= 60) return prev + 0.5;
        return prev + 2;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Update status text based on progress
  useEffect(() => {
    if (loadingStep < 30) setStatusText("Analyzing essay structure...");
    else if (loadingStep < 60) setStatusText("Checking grammar and vocabulary...");
    else if (loadingStep < 90) setStatusText("Generating scoring and feedback...");
    else setStatusText("Finalizing report...");
  }, [loadingStep]);

  useEffect(() => {
    const processEvaluation = async () => {
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

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
           // Wait a bit for auth to restore if needed, or fail
           // For now fail immediately as rewrite page checks auth before redirect
           throw new Error("Authentication required.");
        }

        // Use streaming API but wait for full response
        // Note: The rewrite flow currently expects a single JSON response, not a stream
        // We need to adapt this to handle the streaming response or use a non-streaming endpoint
        // For now, we'll accumulate the stream or assume the API can handle non-streaming mode
        // Actually, /api/evaluate IS a streaming endpoint now.
        // We need to use experimental_useObject or similar, OR consume the stream manually.
        // Since this page is "Processing...", consuming manually is fine.
        
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
           if (res.status === 401) throw new Error("Session expired. Please log in.");
           const errorData = await res.json();
           throw new Error(errorData.error || 'Evaluation failed');
        }

        // Consume the stream to get the final object
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let resultText = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resultText += decoder.decode(value, { stream: true });
          }
        }
        
        // The stream returns a series of JSON objects (protocol). 
        // We need the final accumulated state or the ID that is saved.
        // BUT, /api/evaluate saves to DB in the background (after).
        // It does NOT return the ID in the stream response itself usually.
        // The stream response is the AI content.
        
        // Wait for the background save to complete.
        // We need to poll Supabase for the new evaluation ID, similar to Workshop page.
        
        let attempts = 0;
        const checkSaved = async (): Promise<string> => {
           if (attempts > 10) throw new Error("Evaluation saved, but could not retrieve ID.");
           attempts++;
           
           const { data, error } = await supabase
             .from('essays')
             .select('evaluations(id)')
             .eq('user_id', session!.user.id)
             .order('submitted_at', { ascending: false })
             .limit(1)
             .single();
             
           if (data?.evaluations?.[0]?.id) {
             return data.evaluations[0].id;
           }
           
           await new Promise(r => setTimeout(r, 1000));
           return checkSaved();
        };
        
        const newEvalId = await checkSaved();

        if (newEvalId) {
          // Success! Clear storage and redirect
          sessionStorage.removeItem(storageKey);
          router.replace(`/evaluation/${newEvalId}`);
        } else {
          throw new Error("No evaluation ID returned");
        }

      } catch (err) {
        console.error("Processing error:", err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    };

    // Small delay to ensure UI renders first and simulation feels real
    const timer = setTimeout(() => {
      processEvaluation();
    }, 1000);

    return () => clearTimeout(timer);
  }, [storageKey, router]);

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

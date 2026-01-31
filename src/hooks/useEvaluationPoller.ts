import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useEvaluationPoller() {
  const [isPolling, setIsPolling] = useState(false);
  const supabase = createClient();

  const pollForEvaluationId = useCallback(async (userId: string, maxAttempts = 20): Promise<string> => {
    setIsPolling(true);
    
    // Helper sleep function
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Wait before checking (1s fixed interval)
        // We wait at the start of the loop (except first time? No, wait first too to give server time)
        // Actually, let's check immediately once, then wait.
        if (attempt > 0) await sleep(1000);

        // Look for the most recent evaluation for this user
        const { data, error } = await supabase
          .from('essays')
          .select('evaluations(id)')
          .eq('user_id', userId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single();

        // If error (e.g. network), just log and retry
        if (error) {
          // Ignore "PGRST116" (no rows) if it happens, but we expect at least one essay if they just submitted
          // But maybe the essay transaction hasn't committed yet?
          console.warn(`[Poller] Attempt ${attempt + 1} query error:`, error.message);
        }

        // Check if we have an evaluation ID
        // Note: data.evaluations might be an array or null depending on the relationship
        if (data?.evaluations && Array.isArray(data.evaluations) && data.evaluations.length > 0) {
           const evalId = data.evaluations[0].id;
           if (evalId) {
             console.log(`[Poller] Found evaluation ID: ${evalId}`);
             return evalId;
           }
        }
      }
      
      throw new Error("Evaluation processing timed out. The report may appear in your history shortly.");
    } finally {
      setIsPolling(false);
    }
  }, [supabase]);

  return { pollForEvaluationId, isPolling };
}

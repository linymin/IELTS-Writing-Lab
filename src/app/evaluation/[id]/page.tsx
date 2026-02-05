import { createClient } from '@supabase/supabase-js';
import EvaluationReport from '@/components/EvaluationReport';
import EvaluationCleanup from '@/components/EvaluationCleanup';
import { formatEvaluation } from '@/lib/score-adapter';
import { notFound, redirect } from 'next/navigation';

// Initialize Supabase Client (Server-side safe)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch Evaluation (Bypass RLS for server-side fetching by using Service Role Key if available, or just standard client)
  // Since we are in a server component, we don't have the user's session automatically attached to `supabase` client unless we use cookies/auth helpers.
  // However, the standard `createClient` with ANON key usually respects RLS. 
  // If the user is not "logged in" in this server context (which they aren't, because we didn't pass cookies), 
  // RLS will block the read because `auth.uid()` is null.
  
  // Solution: For this specific "view" page, we might want to allow public read access via RLS if we have the UUID (unpredictable ID), 
  // OR we need to use the Service Role Key to bypass RLS for fetching.
  // Given this is a simple app, let's use the Service Role Key for server-side fetching to ensure we can render the page.
  // WARNING: This bypasses RLS. Ensure IDs are UUIDs and hard to guess.

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Fallback to Anon but likely fail if RLS is strict
  );

  const { data: evalData, error: evalError } = await supabaseAdmin
    .from('evaluations')
    .select('*')
    .eq('id', id)
    .single();

  if (evalError || !evalData) {
    console.error("Error fetching evaluation:", evalError);
    notFound();
  }

  // Fetch Essay
  const { data: essayData, error: essayError } = await supabaseAdmin
    .from('essays')
    .select('*')
    .eq('id', evalData.essay_id)
    .single();

  if (essayError || !essayData) {
    console.error("Error fetching essay:", essayError);
    notFound();
  }

  // Construct Data for Adapter
  // Handle potentially nested feedback structure and inject scores
  const detailed = evalData.detailed_feedback || {};
  let mergedFeedback = { ...detailed };

  // If detailed_feedback has a 'dimensions' property (e.g. from API route), flatten it
  if (detailed.dimensions && typeof detailed.dimensions === 'object') {
    mergedFeedback = { ...mergedFeedback, ...detailed.dimensions };
  }
  
  const scores = evalData.band_scores || {};
  
  // Explicitly inject scores into dimension objects
  ['TR', 'CC', 'LR', 'GRA'].forEach(dim => {
    const existing = mergedFeedback[dim] || {};
    // Ensure existing is an object
    const safeExisting = typeof existing === 'object' ? existing : {};
    
    mergedFeedback[dim] = { 
      ...safeExisting, 
      score: scores[dim] ?? safeExisting.score
    };
  });

  const rawData = {
    ...mergedFeedback,
    topic: essayData.question_text,
    overallScore: evalData.overall_band
  };

  const report = formatEvaluation(rawData, essayData.essay_body, essayData.task_type as 'task1' | 'task2');

  // We need a way to handle "New Essay" (Reset). 
  // Since this is a server component, we can pass a server action or just a link to dashboard.
  // EvaluationReport accepts `onReset`. We can't pass a function from server to client easily that does navigation unless it's a Server Action or we wrap it.
  // However, for simplicity, we can just omit onReset or pass a client wrapper.
  // Actually, EvaluationReport is a client component? No, I defined it with 'use client' ?
  // Let me check EvaluationReport.tsx.
  
  return (
    <div>
      <EvaluationCleanup evaluationId={id} />
      <EvaluationReport 
        result={report} 
        essay={essayData.essay_body} 
        rewriteLink={`/evaluation/${id}/rewrite`}
      />
    </div>
  );
}

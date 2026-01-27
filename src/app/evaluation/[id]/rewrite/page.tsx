import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { formatEvaluation } from '@/lib/score-adapter';
import RewriteClient from './RewriteClient';

export default async function RewritePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Initialize Supabase Client (Service Role for data fetching)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch Evaluation
  const { data: evalData, error: evalError } = await supabaseAdmin
    .from('evaluations')
    .select('*')
    .eq('id', id)
    .single();

  if (evalError || !evalData) {
    console.error("Error fetching evaluation:", evalError);
    notFound();
  }

  // 2. Fetch Essay
  const { data: essayData, error: essayError } = await supabaseAdmin
    .from('essays')
    .select('*')
    .eq('id', evalData.essay_id)
    .single();

  if (essayError || !essayData) {
    console.error("Error fetching essay:", essayError);
    notFound();
  }

  // 3. Prepare Data
  const detailed = evalData.detailed_feedback || {};
  let mergedFeedback = { ...detailed };

  if (detailed.dimensions && typeof detailed.dimensions === 'object') {
    mergedFeedback = { ...mergedFeedback, ...detailed.dimensions };
  }
  
  const scores = evalData.band_scores || {};
  
  ['TR', 'CC', 'LR', 'GRA'].forEach(dim => {
    const existing = mergedFeedback[dim] || {};
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

  return (
    <RewriteClient
      originalEssayBody={essayData.essay_body}
      originalReport={report}
      questionText={essayData.question_text}
      taskType={essayData.task_type || 'task2'} // Default to task2 if missing
      evaluationId={id}
    />
  );
}

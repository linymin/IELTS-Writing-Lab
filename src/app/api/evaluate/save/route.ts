import { NextRequest, NextResponse } from 'next/server';
import { ScoreRequest } from '@/types/ielts';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { data, originalBody } = await request.json();

    // 1. Auth Check (Get User ID)
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    const supabaseClient = authHeader 
      ? createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        })
      : supabase;

    if (authHeader) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId) {
       return NextResponse.json(
        { error: 'Authentication required to save results.' },
        { status: 401 }
      );
    }

    // A. Save Essay
    const { data: essayData, error: essayError } = await supabaseClient
      .from('essays')
      .insert({
        user_id: userId,
        task_type: originalBody.task_type,
        question_text: data.topic,
        question_id: originalBody.question_id || null,
        essay_body: originalBody.essay_body,
        word_count: originalBody.essay_body.split(/\s+/).length
      })
      .select()
      .single();

    if (essayError) throw new Error(`Failed to save essay: ${essayError.message}`);

    // B. Save Evaluation
    if (essayData) {
      const { data: evalData, error: evalError } = await supabaseClient
        .from('evaluations')
        .insert({
          essay_id: essayData.id,
          band_scores: {
            TR: data.dimensions.taskResponse.score,
            CC: data.dimensions.coherenceCohesion.score,
            LR: data.dimensions.lexicalResource.score,
            GRA: data.dimensions.grammaticalRangeAccuracy.score
          },
          overall_band: data.overallScore,
          detailed_feedback: {
            dimensions: {
              TR: data.dimensions.taskResponse,
              CC: data.dimensions.coherenceCohesion,
              LR: data.dimensions.lexicalResource,
              GRA: data.dimensions.grammaticalRangeAccuracy
            },
            paragraphRewrites: data.paragraphRewrites,
            toolkit: data.toolkit,
            referenceEssay: data.referenceEssay,
            corrections: data.correctedSentences
          }
        })
        .select()
        .single();
        
      if (evalError) throw new Error(`Failed to save evaluation: ${evalError.message}`);

      // C. Create Attempt Record
      if (evalData) {
        const { count } = await supabaseClient
          .from('essays')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('question_text', data.topic);

        const attemptNo = (count || 0);

        await supabaseClient
          .from('attempts')
          .insert({
            essay_id: essayData.id,
            evaluation_id: evalData.id,
            attempt_no: attemptNo,
            trend_comment: attemptNo > 1 ? "Keep practicing!" : "First attempt"
          });
          
        return NextResponse.json({ id: evalData.id });
      }
    }

    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });

  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json(
      { error: 'Failed to save evaluation' }, 
      { status: 500 }
    );
  }
}
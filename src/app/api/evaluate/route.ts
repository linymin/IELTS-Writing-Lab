import { NextRequest, NextResponse } from 'next/server';
import { ScoreRequest } from '@/types/ielts';
import { createOpenAI } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { getSystemPrompt, IELTS_TASK1_RUBRIC_MD, IELTS_TASK2_RUBRIC_MD } from '@/lib/prompts/ielts-rubric';
import { getEvaluationSchema } from '@/lib/schemas/evaluation';

/**
 * POST /api/evaluate
 * Receives an essay and streams a 16-dimension score using Vercel AI SDK & Doubao.
 * Now supports streaming to prevent Vercel timeouts.
 */

export const maxDuration = 60; // Allow up to 60 seconds for execution (Vercel Hobby limit)

// Initialize OpenAI provider with Doubao configuration
const doubao = createOpenAI({
  apiKey: process.env.DOUBAO_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
});

// Initialize Supabase Client for Auth Check only
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString();
  console.log(`[${new Date().toISOString()}] [Req:${requestId}] Incoming streaming evaluation request`);
  
  try {
    const body: ScoreRequest = await request.json();

    // 1. Validation
    if (!body.essay_body || !body.task_type || !body.question_text) {
      return NextResponse.json(
        { error: 'Missing required fields: essay_body, task_type, question_text' },
        { status: 400 }
      );
    }

    if (body.essay_body.length < 50) {
      return NextResponse.json(
        { error: 'Essay is too short to evaluate (minimum 50 characters).' },
        { status: 400 }
      );
    }

    // 2. Auth Check (Get User ID)
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (user) userId = user.id;
    } else {
      console.warn("No Authorization header found.");
    }

    if (!userId) {
       return NextResponse.json(
        { error: 'Authentication required to save results. Please refresh and try again.' },
        { status: 401 }
      );
    }

    // 3. Prepare Prompt
    const selectedRubric = body.task_type === 'task1' ? IELTS_TASK1_RUBRIC_MD : IELTS_TASK2_RUBRIC_MD;
    const baseSystemPrompt = getSystemPrompt(body.task_type);
    const finalSystemPrompt = `${baseSystemPrompt}\n\n[Specific Rubric for ${body.task_type.toUpperCase()}]\n${selectedRubric}`;

    const userPrompt = `
Task Type: ${body.task_type}
Question: ${body.question_text}
Essay:
${body.essay_body}
`;

    const modelId = process.env.DOUBAO_MODEL || 'ep-20250207172827-2k29f'; // Fallback or env

    // 4. Stream Object
    const result = streamObject({
      model: doubao(modelId),
      schema: getEvaluationSchema(body.task_type),
      system: finalSystemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      // Removed onFinish DB logic to prevent timeouts. 
      // Client will handle saving after stream completes.
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate evaluation' }, 
      { status: 500 }
    );
  }
}

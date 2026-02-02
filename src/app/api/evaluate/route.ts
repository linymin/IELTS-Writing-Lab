import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server'; // Next.js 15+ feature for background tasks
import { ScoreRequest } from '@/types/ielts';
import { createOpenAI } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { getSystemPrompt, IELTS_TASK1_RUBRIC_MD, IELTS_TASK2_RUBRIC_MD } from '@/lib/prompts/ielts-rubric';
import { getEvaluationSchema } from '@/lib/schemas/evaluation';

export const runtime = 'nodejs'; // Use Node.js Runtime for better stability in Docker
export const maxDuration = 300; // Allow up to 5 minutes for AI processing

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // For dev; restrict in prod if needed
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/evaluate
 * Receives an essay and streams a 16-dimension score using Vercel AI SDK & Doubao.
 * Now supports streaming to prevent Vercel timeouts.
 */

// Initialize OpenAI provider with Doubao configuration
const doubao = createOpenAI({
  apiKey: process.env.DOUBAO_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
});

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to save results to Supabase (runs in background)
async function saveEvaluationToDB(
  data: any, 
  userId: string, 
  originalBody: ScoreRequest, 
  authHeader: string | null
) {
  try {
    // Re-create authenticated client for RLS
    const supabaseClient = authHeader 
      ? createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        })
      : supabase;

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
          
        console.log(`[Background] Saved evaluation ${evalData.id} for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("[Background] Database persistence failed:", error);
  }
}

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString();
  console.log(`[${new Date().toISOString()}] [Req:${requestId}] Incoming streaming evaluation request`);
  
  try {
    const body: ScoreRequest = await request.json();

    // 1. Validation
    if (!body.essay_body || !body.task_type || !body.question_text) {
      return NextResponse.json(
        { error: 'Missing required fields: essay_body, task_type, question_text' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (body.essay_body.length < 50) {
      return NextResponse.json(
        { error: 'Essay is too short to evaluate (minimum 50 characters).' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Auth Check (Get User ID)
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Use the token explicitly to get the user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
         console.error(`[Auth] Token verification failed: ${authError.message}`);
      } else if (user) {
         userId = user.id;
         console.log(`[Auth] Request authorized for user: ${userId}`);
      }
    } else {
      console.warn("[Auth] No Bearer Authorization header found.");
    }

    if (!userId) {
       return NextResponse.json(
        { error: 'Authentication required to save results. Please refresh and try again.' },
        { status: 401, headers: corsHeaders }
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

    // Debugging: Check Environment Variables (Masked)
    const apiKey = process.env.DOUBAO_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Critical Error: DOUBAO_API_KEY or OPENAI_API_KEY is missing in environment variables.");
      return NextResponse.json(
        { error: 'Server configuration error: Missing API Key' },
        { status: 500, headers: corsHeaders }
      );
    }

    const modelId = process.env.DOUBAO_MODEL || 'ep-20250207172827-2k29f'; 
    console.log(`[Evaluate] Using Model ID: ${modelId}`);

    // 4. Stream Object
    const result = streamObject({
      model: doubao(modelId),
      schema: getEvaluationSchema(body.task_type),
      system: finalSystemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });

    // Register background task immediately at the top level
    // This awaits the FULL object resolution in the background
    after(async () => {
      try {
        const object = await result.object;
        if (object && userId) {
           await saveEvaluationToDB(object, userId!, body, authHeader);
        }
      } catch (err) {
        console.error("Background processing error:", err);
      }
    });

    const coreResponse = result.toTextStreamResponse();
    
    // Create a custom stream to inject whitespace heartbeats
    // This prevents cloud gateways (like Tencent Cloud) from closing the connection due to idle timeout
    // during the "thinking" phase of the LLM (which can take 40-60s).
    const customStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // 1. Send initial keep-alive byte immediately
        controller.enqueue(encoder.encode(' '));
        
        // 2. Setup periodic keep-alive (every 15s)
        const keepAliveInterval = setInterval(() => {
          try {
             // Enqueue a space to reset the idle timer
             controller.enqueue(encoder.encode(' '));
          } catch (e) {
             clearInterval(keepAliveInterval);
          }
        }, 15000);

        const reader = coreResponse.body?.getReader();
        
        if (!reader) {
           clearInterval(keepAliveInterval);
           controller.close();
           return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            // As soon as we get the first real chunk from the LLM, stop the heartbeat
            if (!done) {
                 clearInterval(keepAliveInterval);
            }
            
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          clearInterval(keepAliveInterval);
          controller.error(err);
        }
      }
    });

    // Create new headers based on the original response
    const newHeaders = new Headers(coreResponse.headers);
    // Ensure CORS headers are present
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    
    return new NextResponse(customStream, {
       status: coreResponse.status,
       statusText: coreResponse.statusText,
       headers: newHeaders
    });

  } catch (error: any) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: `Failed to initiate evaluation: ${error.message}` }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

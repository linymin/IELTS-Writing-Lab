import { NextRequest, NextResponse } from 'next/server';
import { ScoreRequest } from '@/types/ielts';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getSystemPrompt, IELTS_TASK1_RUBRIC_MD, IELTS_TASK2_RUBRIC_MD } from '@/lib/prompts/ielts-rubric';
import { formatEvaluation } from '@/lib/score-adapter';

/**
 * POST /api/evaluate
 * Receives an essay and returns a 4-dimension score using ByteDance Doubao Model.
 * Protocol defined in: docs/architecture/03_llm_api_protocol.md
 */

// Initialize OpenAI client with Doubao configuration
const client = new OpenAI({
  apiKey: process.env.DOUBAO_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
});

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString();
  console.log(`[${new Date().toISOString()}] [Req:${requestId}] Incoming evaluation request`);
  
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

    // 2. Select Rubric based on Task Type
    const selectedRubric = body.task_type === 'task1' ? IELTS_TASK1_RUBRIC_MD : IELTS_TASK2_RUBRIC_MD;
    
    // Inject rubric into system prompt
    const baseSystemPrompt = getSystemPrompt(body.task_type);
    const finalSystemPrompt = `${baseSystemPrompt}\n\n[Specific Rubric for ${body.task_type.toUpperCase()}]\n${selectedRubric}`;

    // 2. Call Doubao API
    const modelId = process.env.DOUBAO_MODEL;
    if (!modelId) {
      return NextResponse.json(
        { error: 'Server Configuration Error: DOUBAO_MODEL is missing.' },
        { status: 500 }
      );
    }

    const userPrompt = `
Task Type: ${body.task_type}
Question: ${body.question_text}
Essay:
${body.essay_body}
`;

    console.log(`[${new Date().toISOString()}] Sending request to Doubao... Model: ${modelId}`);
    const startTime = Date.now();

    let content = "{}";
    try {
      const completion = await client.chat.completions.create({
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: modelId,
        response_format: { type: "json_object" },
        temperature: 0.3, 
      });
      
      console.log(`[${new Date().toISOString()}] [Req:${requestId}] Doubao responded in ${Date.now() - startTime}ms`);
      content = completion.choices[0].message.content || "{}";
    } catch (llmError) {
      console.error("LLM Call Failed:", llmError);
      // Fallback is handled by safeTransform/formatEvaluation below, 
      // but we might want to log specific error or return a "service busy" if critical.
      // For now, proceeding to safeTransform to return a default score to avoid white screen.
    }

    console.log("[Original AI Response]", content.substring(0, 200) + "...");

    // 3. Adapter / Data Cleaning
    let rawJson = {};
    try {
      rawJson = JSON.parse(content);
    } catch (e) {
      console.warn("Failed to parse LLM response as JSON. Using empty object.");
    }

    // Combine original input data with LLM response for the adapter to handle
    const fullRawData = {
      ...rawJson,
      question_text: body.question_text // Ensure topic is available for adapter
    };

    const cleanedData = formatEvaluation(fullRawData, body.essay_body, body.task_type);
    
    console.log("[Adapted Data]", JSON.stringify(cleanedData, null, 2).substring(0, 200) + "...");

    // 4. Data Persistence (Supabase)
    const authHeader = request.headers.get('Authorization');
    
    // Create an authenticated Supabase client if a token is present
    const supabaseClient = authHeader 
      ? createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        })
      : supabase;

    let userId: string | null = null;

    if (authHeader) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError) {
        console.error("Auth Error:", authError);
      }
      if (user) {
        userId = user.id;
      }
    } else {
      console.warn("No Authorization header found.");
    }

    if (!userId) {
       // Optional: For dev mode, create a temporary user or fail?
       // For now, let's return error to force frontend to handle auth correctly.
       // Or we can just log it and proceed (but DB save will be skipped).
       console.error("User ID is missing. Skipping database persistence.");
       return NextResponse.json(
        { error: 'Authentication required to save results. Please refresh and try again.' },
        { status: 401 }
      );
    }

    if (userId) {
      try {
        // A. Save Essay
        // Use supabaseClient which has the auth context
        const { data: essayData, error: essayError } = await supabaseClient
          .from('essays')
          .insert({
            user_id: userId,
            task_type: body.task_type,
            question_text: cleanedData.topic, // Use cleaned topic
            question_id: body.question_id || null,
            essay_body: body.essay_body,
            word_count: body.essay_body.split(/\s+/).length
          })
          .select()
          .single();

        if (essayError) {
            console.error("Essay Insert Error:", essayError);
            throw new Error(`Failed to save essay: ${essayError.message}`);
        }

        // B. Save Evaluation
        if (essayData) {
            // Map back to DB schema
            const { data: evalData, error: evalError } = await supabaseClient
            .from('evaluations')
            .insert({
              essay_id: essayData.id,
              band_scores: {
                TR: cleanedData.dimensions.taskResponse.score,
                CC: cleanedData.dimensions.coherenceCohesion.score,
                LR: cleanedData.dimensions.lexicalResource.score,
                GRA: cleanedData.dimensions.grammaticalRangeAccuracy.score
              },
              overall_band: cleanedData.overallScore,
              detailed_feedback: {
                dimensions: {
                  TR: cleanedData.dimensions.taskResponse,
                  CC: cleanedData.dimensions.coherenceCohesion,
                  LR: cleanedData.dimensions.lexicalResource,
                  GRA: cleanedData.dimensions.grammaticalRangeAccuracy
                },
                paragraphRewrites: cleanedData.paragraphRewrites,
                toolkit: cleanedData.toolkit,
                referenceEssay: cleanedData.referenceEssay,
                corrections: cleanedData.correctedSentences
              }
            })
            .select()
            .single();
            
            if (evalError) {
                console.error("Evaluation Insert Error:", evalError);
                throw new Error(`Failed to save evaluation: ${evalError.message}`);
            }

            // C. Create Attempt Record
            if (evalData) {
              const { count } = await supabaseClient
                .from('essays')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('question_text', cleanedData.topic);

              const attemptNo = (count || 0);

              await supabaseClient
                .from('attempts')
                .insert({
                  essay_id: essayData.id,
                  evaluation_id: evalData.id,
                  attempt_no: attemptNo,
                  trend_comment: attemptNo > 1 ? "Keep practicing!" : "First attempt"
                });

               // Return the evaluation ID
               return NextResponse.json({ ...cleanedData, id: evalData.id });
            }
        }
      } catch (dbError) {
        console.error("Database persistence failed:", dbError);
        return NextResponse.json(
            { error: dbError instanceof Error ? dbError.message : 'Database error' },
            { status: 500 }
        );
      }
    }

    return NextResponse.json(cleanedData);

  } catch (error) {
    console.error('Evaluation error:', error);
    // Return a safe default instead of 500 to avoid white screen
    return NextResponse.json(formatEvaluation({})); 
  }
}

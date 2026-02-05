'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { createClient } from '@/lib/supabase/client';
import { useEvaluationPoller } from '@/hooks/useEvaluationPoller';
import { z } from 'zod';

// Define the feedback schema (same as in Workshop)
const feedbackSchema = z.object({
  overallScore: z.number().optional(),
  dimensions: z.object({
    taskResponse: z.object({ score: z.number().optional() }).optional(),
    coherenceCohesion: z.object({ score: z.number().optional() }).optional(),
    lexicalResource: z.object({ score: z.number().optional() }).optional(),
    grammaticalRangeAccuracy: z.object({ score: z.number().optional() }).optional(),
  }).optional(),
}).passthrough();

type EvaluationStage = 
  | 'analyzing_structure' 
  | 'evaluating_standards' 
  | 'generating_suggestions' 
  | 'compiling_report' 
  | 'complete';

interface EvaluationContextType {
  isEvaluating: boolean;
  progress: number; // 0 to 100
  elapsedSeconds: number;
  timeLeft: number; // 300 - elapsed
  currentStage: string;
  isComplete: boolean;
  evaluationId: string | null;
  activeEvaluationId: string | null; // Tracks which specific evaluation (parent) is being processed
  startEvaluation: (payload: any, parentEvaluationId?: string) => Promise<void>;
  cancelEvaluation: () => void;
  resetEvaluation: () => void;
  navigateToReport: () => void;
  error: string | null;
}

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

export function EvaluationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const { pollForEvaluationId } = useEvaluationPoller();
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [activeEvaluationId, setActiveEvaluationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiFinished, setApiFinished] = useState(false);

  // Audio ref for completion sound
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/complete.mp3'); // We'll need to add this file or use a placeholder
  }, []);

  const playCompletionSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  // Streaming Hook
  const { object: streamingResult, submit, isLoading, error: streamError } = useObject({
    api: '/api/evaluate',
    schema: feedbackSchema,
    fetch: async (url, options) => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("User session not found. Please log in.");
        
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...options, headers });
    },
    onFinish: async ({ error }) => {
       if (error) {
         setError("Evaluation failed: " + error.message);
         setIsEvaluating(false);
         return;
       }
       setApiFinished(true);
    }
  });

  // Polling Logic (runs when API finishes)
  useEffect(() => {
    if (apiFinished && !evaluationId) {
      const fetchId = async () => {
        try {
           const { data: { user } } = await supabase.auth.getUser();
           if (!user) return;
           
           const id = await pollForEvaluationId(user.id);
           if (id) {
               setEvaluationId(id);
               setIsComplete(true);
               playCompletionSound();
           }
        } catch (err) {
           console.error("Polling error:", err);
           setError("Failed to retrieve evaluation ID.");
        }
      };
      fetchId();
    }
  }, [apiFinished, evaluationId, pollForEvaluationId, supabase.auth]);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isEvaluating && !isComplete) {
      if (!startTime) setStartTime(Date.now());
      
      interval = setInterval(() => {
        setElapsedSeconds(prev => {
           if (prev >= 300) return 300;
           return prev + 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isEvaluating, isComplete, startTime]);

  // Stage Calculation
  const getStageInfo = (seconds: number, complete: boolean) => {
    if (complete) return "Evaluation Complete!";
    
    if (seconds < 30) return "🔍 Deeply analyzing your essay structure...";
    if (seconds < 120) return "🤖 AI evaluating against IELTS standards...";
    if (seconds < 240) return "✍️ Generating personalized grammar & vocabulary suggestions...";
    return "📊 Compiling report & syncing history...";
  };

  const currentStage = getStageInfo(elapsedSeconds, isComplete);
  const progress = isComplete ? 100 : Math.min((elapsedSeconds / 300) * 100, 100);
  const timeLeft = Math.max(300 - elapsedSeconds, 0);

  const startEvaluation = useCallback(async (payload: any, parentEvaluationId?: string) => {
    setError(null);
    setIsEvaluating(true);
    setIsComplete(false);
    setApiFinished(false);
    setEvaluationId(null);
    setActiveEvaluationId(parentEvaluationId || null);
    setElapsedSeconds(0);
    setStartTime(Date.now());
    
    // Start the stream
    submit(payload);
    
    // Redirect to evaluating page immediately
    router.push('/evaluating');
  }, [submit, router]);

  const cancelEvaluation = useCallback(() => {
    setIsEvaluating(false);
    setStartTime(null);
    setElapsedSeconds(0);
    setActiveEvaluationId(null);
    // Ideally abort the fetch request here if possible, but useObject doesn't expose abort easily without unmounting
  }, []);

  const resetEvaluation = useCallback(() => {
    setIsEvaluating(false);
    setIsComplete(false);
    setApiFinished(false);
    setEvaluationId(null);
    setActiveEvaluationId(null);
    setElapsedSeconds(0);
    setError(null);
  }, []);

  const navigateToReport = useCallback(() => {
    if (evaluationId) {
        // Just navigate. Do not reset state yet, so sidebar/EvaluatingPage don't flicker or break.
        // The state will be naturally reset when the user starts a *new* evaluation later.
        router.push(`/evaluation/${evaluationId}`);
    }
  }, [evaluationId, router]);

  return (
    <EvaluationContext.Provider value={{
      isEvaluating,
      progress,
      elapsedSeconds,
      timeLeft,
      currentStage,
      isComplete,
      evaluationId,
      activeEvaluationId,
      startEvaluation,
      cancelEvaluation,
      resetEvaluation,
      navigateToReport,
      error
    }}>
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const context = useContext(EvaluationContext);
  if (context === undefined) {
    throw new Error('useEvaluation must be used within an EvaluationProvider');
  }
  return context;
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEvaluation } from '@/lib/context/evaluation-context';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { 
  Timer,
  Pause,
  LogOut,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MOCK_QUESTIONS } from '@/lib/mock-questions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function WorkshopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { startEvaluation, isEvaluating } = useEvaluation();
  const { language } = useLanguage();
  
  const qid = searchParams.get('qid'); // Legacy mock support
  const question_id = searchParams.get('question_id'); // Supabase support
  const initialTopic = searchParams.get('topic'); // Custom topic support
  const initialTaskType = searchParams.get('taskType'); // Custom task type support

  const [topic, setTopic] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(2400); // Default to Task 2 (40 mins)
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Check Configuration
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("System Configuration Error: Supabase URL or Key is missing. Please check your .env.local file.");
    }
  }, []);

  // Load Question from ID (Mock or Supabase) or Initial Params
  useEffect(() => {
    const fetchQuestion = async () => {
      if (question_id) {
        setIsLoadingQuestion(true);
        try {
          const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', question_id)
            .single();

          if (error) throw error;

          if (data) {
            // Clean content by removing redundant "Write at least..." instructions
            let cleanContent = data.content || '';
            cleanContent = cleanContent.replace(/Write at least \d+ words\.?/gi, '').trim();
            
            setTopic(cleanContent);
            setImageUrl(data.image_url || null);
            setTaskType(data.task_type === 'task1' || data.task_type === 1 ? 'task1' : 'task2');
          }
        } catch (err) {
          console.error('Error fetching question:', err);
          setError('Failed to load question');
        } finally {
          setIsLoadingQuestion(false);
        }
      } else if (qid) {
        // Fallback to Mock
        const question = MOCK_QUESTIONS.find(q => q.id === qid);
        if (question) {
          setTopic(question.content);
          setTaskType(question.task_type === 1 ? 'task1' : 'task2');
        }
      } else if (initialTopic) {
        // Handle custom topic passed via URL
        setTopic(decodeURIComponent(initialTopic));
        if (initialTaskType) {
          setTaskType(initialTaskType === 'task1' ? 'task1' : 'task2');
        }
      } else {
        // Reset state if no ID provided
        setTopic('');
        setImageUrl(null);
      }
    };

    fetchQuestion();
  }, [qid, question_id, initialTopic, initialTaskType]);

  // Timer Logic
  useEffect(() => {
    setTimeLeft(taskType === 'task1' ? 1200 : 2400);
    setIsTimerRunning(false);
  }, [taskType]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEvaluate = async () => {
    // 0. Check global evaluation state
    if (isEvaluating) {
        alert("An evaluation is currently in progress. Please wait for it to complete.");
        return;
    }

    // 1. Validate Essay Length
    if (!essay.trim() || essay.length < 50) {
      setError("Essay is too short. Please write at least 50 characters.");
      return;
    }

    // 2. Validate Topic
    if (!topic.trim()) {
        setError("Question topic is missing. Please enter a question or select one from the question bank.");
        return;
    }

    setError(null);

    let finalQuestionId = question_id;

    // 3. Handle Custom Question Persistence
    // If no existing question_id, this is a custom topic. We must save/retrieve it.
    if (!finalQuestionId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Check if question exists for this user to avoid duplicates
          // We use 'content' + 'user_id' as the unique key for custom questions
          const { data: existingQ } = await supabase
            .from('questions')
            .select('id')
            .eq('user_id', user.id)
            .eq('content', topic)
            .maybeSingle();

          if (existingQ) {
            finalQuestionId = existingQ.id;
          } else {
            // Create new custom question
            const { data: newQ, error: insertError } = await supabase
              .from('questions')
              .insert({
                user_id: user.id,
                content: topic,
                topic: 'Custom Topic', // Default category
                question_type: 'Custom',
                task_type: taskType === 'task1' ? 1 : 2,
                // book_no, test_no are null by default
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            if (newQ) finalQuestionId = newQ.id;
          }
        }
      } catch (err) {
        console.error('Error ensuring custom question exists:', err);
        setError("Failed to save custom topic. Please check your connection.");
        return;
      }
    }

    // Call streaming submit via Global Context
    await startEvaluation({
      essay_body: essay,
      task_type: taskType,
      question_text: topic,
      question_id: finalQuestionId || null,
      language: language || 'en' // Pass current language preference
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar - Exam Style */}
      <header className="h-16 bg-slate-900 text-white shrink-0 flex items-center justify-between px-6 shadow-md z-20 relative">
        {/* Left: Logo & Task Info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium text-sm">Current Task:</span>
            {question_id || qid ? (
              <div className="px-3 py-1.5 rounded text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 cursor-default">
                {taskType === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)'}
              </div>
            ) : (
              <div className="relative group">
                <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-slate-700">
                  {taskType === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)'}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {/* Dropdown for task selection */}
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden hidden group-hover:block text-slate-800">
                  <button 
                    onClick={() => setTaskType('task1')}
                    className={cn("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", taskType === 'task1' && "bg-blue-50 text-blue-600 font-medium")}
                  >
                    Task 1 (Report)
                  </button>
                  <button 
                    onClick={() => setTaskType('task2')}
                    className={cn("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", taskType === 'task2' && "bg-blue-50 text-blue-600 font-medium")}
                  >
                    Task 2 (Essay)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Timer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-3 text-2xl font-mono font-bold tracking-widest text-white/90">
            <Timer className="w-6 h-6 text-blue-400" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded shadow-sm border border-slate-700 text-sm font-medium transition-all flex items-center gap-2"
          >
            {isTimerRunning ? <Pause className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
            {isTimerRunning ? 'Pause' : 'Start'}
          </button>
          
          <button 
            onClick={handleEvaluate}
            className={cn(
              "bg-slate-100 hover:bg-white text-slate-900 px-6 py-2 rounded shadow-sm font-bold text-sm transition-all flex items-center gap-2",
              isEvaluating && "opacity-50 cursor-not-allowed"
            )}
          >
            Submit
          </button>
          
          <button className="bg-slate-800 hover:bg-red-900/50 hover:border-red-800 text-slate-300 hover:text-red-200 px-4 py-2 rounded shadow-sm border border-slate-700 text-sm font-medium transition-all flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Quit
          </button>
        </div>
      </header>

      {/* Main Content Area - Split View */}
      <main className="flex-1 flex p-4 gap-4 overflow-hidden relative z-10">
        
        {/* Left Panel: Question / Reading */}
        <div className="w-1/2 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-0 relative overflow-y-auto">
            {isLoadingQuestion ? (
              <div className="flex items-center justify-center h-full text-slate-400 animate-pulse">
                 <span>Loading question...</span>
              </div>
            ) : question_id ? (
              <div className="p-6 md:p-8 font-sans">
                <div className="prose prose-slate max-w-none">
                  <h3 className="text-lg font-bold text-black mb-4">
                    {taskType === 'task1' ? 'Part 1' : 'Part 2'}
                  </h3>
                  
                  <div className="mb-6 text-base text-gray-800">
                    You should spend about {taskType === 'task1' ? '20' : '40'} minutes on this task. Write at least {taskType === 'task1' ? '150' : '250'} words.
                  </div>

                  <div className="mb-6">
                    <p className="text-black mb-4 text-base">Write about the following topic:</p>
                    <div className="font-bold text-black whitespace-pre-wrap leading-relaxed">
                      {topic}
                    </div>
                  </div>

                  {taskType === 'task2' && (
                    <div className="text-gray-800 leading-relaxed">
                      Give reasons for your answer and include any relevant examples from your own knowledge or experience.
                    </div>
                  )}

                  {imageUrl && (
                    <div className="mt-6">
                      <img src={imageUrl} alt="Task Chart" className="max-w-full h-auto rounded border border-slate-200" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <textarea
                  className="w-full h-full p-6 md:p-8 outline-none resize-none text-black text-base leading-relaxed font-sans bg-white"
                  placeholder="Paste the IELTS question here..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                {!topic && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                    <div className="text-center">
                      <p className="text-xl font-medium text-slate-400">Paste Question Here</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel: Writing Area */}
        <div className="w-1/2 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative">
            <textarea
              className="w-full h-full p-6 outline-none resize-none text-black text-base leading-relaxed font-sans placeholder:text-slate-300"
              placeholder="Start typing your essay here..."
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              spellCheck={false}
            />
            
            {error && (
              <div className="absolute bottom-16 left-6 right-6 p-3 bg-red-50 text-red-600 rounded border border-red-100 flex items-center gap-2 text-sm shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Bottom Info Bar for Writing Area */}
          <div className="bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center text-sm text-slate-500">
             <span>Status: {isTimerRunning ? 'Writing...' : 'Paused'}</span>
             <div className="flex items-center gap-4">
               <span className="font-medium text-slate-900">Word count: {essay.split(/\s+/).filter(Boolean).length}</span>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function Workshop() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400">Loading...</div>}>
      <WorkshopContent />
    </Suspense>
  );
}

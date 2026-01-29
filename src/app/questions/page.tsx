'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, BookOpen, Filter, ArrowRight, Map as MapIcon, BarChart, PieChart, MessageSquare, PenTool, LayoutTemplate, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Question } from '@/types/question';

export default function QuestionsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [taskType, setTaskType] = useState<1 | 2>(2);
  const [activeTab, setActiveTab] = useState<'books' | 'category'>('books');
  
  // Data State
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<(Question & { latest_score?: number })[]>([]);

  // Filters
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Constants
  const books = Array.from({ length: 16 }, (_, i) => 20 - i); // 20 down to 5
  
  // Fetch Questions from Supabase
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        // 1. Fetch Questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('task_type', taskType);
        
        if (questionsError) throw questionsError;

        // 2. Fetch User's Attempts (if logged in)
        const { data: { session } } = await supabase.auth.getSession();
        let questionsWithStatus = questionsData || [];

        if (session?.user) {
          const { data: attemptsData } = await supabase
            .from('essays')
            .select(`
              question_id,
              evaluations (
                overall_band,
                created_at
              )
            `)
            .eq('user_id', session.user.id)
            .not('question_id', 'is', null);

          // Map attempts to question_id -> latest score
          const scoreMap = new Map<string, number>();
          
          if (attemptsData) {
            attemptsData.forEach((attempt: any) => {
              if (attempt.question_id && attempt.evaluations && attempt.evaluations.length > 0) {
                // Find latest evaluation if multiple (though normally one per essay, but multiple essays per question possible)
                // The query returns evaluations array. We sort by created_at.
                const sortedEvals = attempt.evaluations.sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                
                const latestScore = sortedEvals[0].overall_band;
                
                // Update map if this attempt is newer than what we have (or if we don't have one)
                // Since we iterate essays, and one question can have multiple essays.
                // We actually need to compare across essays too.
                // Simplified: Just take the latest.
                
                const existing = scoreMap.get(attempt.question_id);
                // We need to know if this essay is the latest for this question.
                // Currently I don't have essay date in the loop easily unless I select it.
                // Let's assume the latest evaluation implies the latest attempt relevance.
                if (!existing || latestScore > existing) { // Or show highest score? User request: "most recent score"
                   // Re-logic: "recently done" -> most recent.
                   // I need essay submitted_at to be sure, or evaluation created_at.
                   // Let's stick to showing the score of the latest evaluation.
                   scoreMap.set(attempt.question_id, latestScore);
                }
              }
            });
            
            // Actually, to get the TRUE latest, we should sort all evaluations for a question.
            // But 'attemptsData' is list of essays.
            // Let's flatten: { question_id, score, date }
            interface ScoredEvaluation {
              qid: string;
              score: number;
              date: string;
            }
            const allEvals: ScoredEvaluation[] = [];
            attemptsData.forEach((essay: any) => {
               if (essay.question_id && essay.evaluations) {
                 essay.evaluations.forEach((ev: any) => {
                   allEvals.push({ 
                     qid: essay.question_id, 
                     score: ev.overall_band, 
                     date: ev.created_at 
                   });
                 });
               }
            });
            
            // Sort by date desc
            allEvals.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Populate map with first found (latest)
            const finalMap = new Map<string, number>();
            allEvals.forEach((ev: any) => {
              if (!finalMap.has(ev.qid)) {
                finalMap.set(ev.qid, ev.score);
              }
            });

            questionsWithStatus = questionsData?.map(q => ({
              ...q,
              latest_score: finalMap.get(q.id)
            })) || [];
          }
        }

        setQuestions(questionsWithStatus);
      } catch (err) {
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [taskType]);

  // Available options derived from fetched data
  const categories = useMemo(() => 
    Array.from(new Set(questions.map(q => q.question_type))).filter(Boolean),
  [questions]);

  const topics = useMemo(() => 
    Array.from(new Set(questions.map(q => q.topic))).filter(Boolean),
  [questions]);

  // Client-side Filter Logic
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Level 1: Task Type (Already filtered by DB query, but safe to keep)
      if (q.task_type !== taskType) return false;

      // Level 2: Tab Logic
      if (activeTab === 'books') {
        if (selectedBook && q.book_no !== selectedBook) return false;
        return true;
      } else {
        if (selectedCategory && q.question_type !== selectedCategory) return false;
        if (selectedTopic && q.topic !== selectedTopic) return false;
        return true;
      }
    });
  }, [questions, taskType, activeTab, selectedBook, selectedCategory, selectedTopic]);

  const handleQuestionClick = (id: string) => {
    router.push(`/workshop?question_id=${id}`);
  };

  const handleTaskTypeChange = (type: 1 | 2) => {
    setTaskType(type);
    setSelectedCategory(null);
    setSelectedTopic(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-blue-600" />
            IELTS Question Bank
          </h1>
          <p className="text-slate-600 mt-2">Practice with real Cambridge questions and get AI feedback.</p>
        </div>
        
        {/* Top Level Task Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-center">
          <button
            onClick={() => handleTaskTypeChange(1)}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              taskType === 1 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart className="w-4 h-4" />
            Task 1
          </button>
          <button
            onClick={() => handleTaskTypeChange(2)}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              taskType === 2 
                ? 'bg-white text-purple-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Task 2
          </button>
        </div>
      </header>

      {/* Sub Navigation (Books vs Category) */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('books')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'books' 
              ? 'text-slate-900' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Cambridge Books
          </div>
          {activeTab === 'books' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-0.5 bg-slate-900 rounded-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('category')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'category' 
              ? 'text-slate-900' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            By Category
          </div>
          {activeTab === 'category' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-0.5 bg-slate-900 rounded-full"></div>
          )}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Book Mode: Book Grid */}
          {activeTab === 'books' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {books.map((book) => (
                  <button
                    key={book}
                    onClick={() => setSelectedBook(selectedBook === book ? null : book)}
                    className={`py-2 px-1 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                      selectedBook === book
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cam</span>
                    <span className="text-lg font-bold">{book}</span>
                  </button>
                ))}
              </div>
              
              {selectedBook && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  Showing <strong>Task {taskType}</strong> questions from <strong>Cambridge {selectedBook}</strong>
                  <button 
                    onClick={() => setSelectedBook(null)}
                    className="text-blue-600 hover:underline ml-2"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Category Mode: Filters */}
          {activeTab === 'category' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Task 2 Specific: Topic Filter (Row 1) */}
              {taskType === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Topic
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedTopic(null)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        !selectedTopic 
                          ? 'bg-slate-900 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All
                    </button>
                    {topics.map(topic => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic === selectedTopic ? null : topic)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          selectedTopic === topic
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Filter (Row 2 for Task 2, Only Row for Task 1) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  {taskType === 1 ? <BarChart className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
                  {taskType === 1 ? 'Chart Type' : 'Question Type'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      !selectedCategory 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Question Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => handleQuestionClick(q.id)}
                  className={`group bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col ${
                    taskType === 1 ? 'hover:border-blue-300' : 'hover:border-purple-300'
                  } border-slate-200 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        taskType === 1 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        Test {q.test_no}
                      </span>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        Cam {q.book_no}
                      </span>
                    </div>
                    
                    {/* Practice Status */}
                    {q.latest_score !== undefined && (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{q.latest_score.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Tags Row */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                      {q.question_type}
                    </span>
                    {q.topic && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                        {q.topic}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-slate-600 text-sm line-clamp-3 mb-4 flex-grow font-serif">
                    {q.content}
                  </p>
                  
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-end items-center">
                    <span className={`font-medium transition-colors group-hover:underline ${
                      taskType === 1 ? 'text-blue-600' : 'text-purple-600'
                    }`}>Start Practice →</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No Task {taskType} questions found matching your filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

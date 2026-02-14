'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, BookOpen, Filter, ArrowRight, Map as MapIcon, BarChart, PieChart, MessageSquare, PenTool, LayoutTemplate, FileText, Loader2, CheckCircle2, PlusCircle, History } from 'lucide-react';
import { Question } from '@/types/question';
import HistoryDrawer from '@/components/HistoryDrawer';
import { EssayGroup, EssayRecord } from '@/types/history';

export default function QuestionsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [taskType, setTaskType] = useState<1 | 2>(2);
  const [activeTab, setActiveTab] = useState<'books' | 'category' | 'custom'>('books');
  
  // Data State
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<(Question & { latest_score?: number, essayGroup?: EssayGroup })[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<EssayGroup | null>(null);

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
        // 1. Fetch Questions (RLS policies will ensure user sees official + their own custom questions)
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('task_type', taskType);
        
        if (questionsError) throw questionsError;

        // 2. Fetch User's Attempts (if logged in)
        const { data: { session } } = await supabase.auth.getSession();
        let questionsWithStatus = questionsData || [];

        if (session?.user) {
          // Fetch essays for current user that have a valid question_id
          const { data: attemptsData } = await supabase
            .from('essays')
            .select(`
              id,
              question_id,
              question_text,
              task_type,
              submitted_at,
              evaluations (
                id,
                overall_band,
                band_scores,
                created_at
              )
            `)
            .eq('user_id', session.user.id)
            .not('question_id', 'is', null);

          // Map attempts to question_id -> EssayGroup
          const groupsMap = new Map<string, EssayGroup>();
          const essaysByQuestion: Record<string, any[]> = {};
          
          if (attemptsData) {
            // Group essays by question_id
            attemptsData.forEach((essay: any) => {
               if (essay.question_id) {
                 if (!essaysByQuestion[essay.question_id]) {
                   essaysByQuestion[essay.question_id] = [];
                 }
                 essaysByQuestion[essay.question_id].push(essay);
               }
            });

            // Process each question group to build history records
            Object.entries(essaysByQuestion).forEach(([qid, essays]) => {
               const records: EssayRecord[] = [];
               essays.forEach((essay: any) => {
                  if (essay.evaluations) {
                     const evals = Array.isArray(essay.evaluations) ? essay.evaluations : [essay.evaluations];
                     evals.forEach((ev: any) => {
                        records.push({
                          id: ev.id,
                          essay_id: essay.id,
                          topic: essay.question_text,
                          overall_score: Number(ev.overall_band),
                          dimensions: ev.band_scores || {},
                          created_at: ev.created_at || essay.submitted_at,
                          task_type: essay.task_type
                        });
                     });
                  }
               });

               if (records.length > 0) {
                  // Sort by date desc
                  records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  
                  groupsMap.set(qid, {
                    topic: records[0].topic,
                    latest: records[0],
                    history: records.slice(1)
                  });
               }
            });

            // Merge status into questions
            questionsWithStatus = questionsData?.map(q => {
              const group = groupsMap.get(q.id);
              return {
                ...q,
                latest_score: group?.latest.overall_score,
                essayGroup: group
              };
            }) || [];
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

  // Available options derived from fetched data (excluding custom topics from standard filters)
  const categories = useMemo(() => 
    Array.from(new Set(questions
      .filter(q => !q.user_id && q.question_type !== 'Custom')
      .map(q => q.question_type)
    )).filter(Boolean),
  [questions]);

  const topics = useMemo(() => 
    Array.from(new Set(questions
      .filter(q => !q.user_id && q.question_type !== 'Custom')
      .map(q => q.topic)
    )).filter(Boolean),
  [questions]);

  // Client-side Filter Logic
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Level 1: Task Type (Already filtered by DB query, but safe to keep)
      if (q.task_type !== taskType) return false;

      // Level 2: Tab Logic
      if (activeTab === 'books') {
        // Only show official questions with book numbers
        if (q.user_id || !q.book_no) return false;
        if (selectedBook && q.book_no !== selectedBook) return false;
        return true;
      } else if (activeTab === 'custom') {
        // Show only custom questions (identified by user_id presence or explicit type)
        return !!q.user_id || q.question_type === 'Custom' || q.question_type === 'Custom Topic';
      } else {
        // Category Mode: Show official questions only
        if (q.user_id) return false;
        
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
        
        <div className="flex gap-4 items-center">
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
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 text-sm font-medium transition-all relative ${
            activeTab === 'custom' 
              ? 'text-slate-900' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4" />
            Custom Topics
          </div>
          {activeTab === 'custom' && (
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

          {/* Custom Mode: Grid with Add Button */}
          {activeTab === 'custom' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Add New Card */}
              <button
                onClick={() => router.push('/workshop')}
                className="group bg-slate-50 p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center min-h-[300px] text-center gap-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Custom Topic</h3>
                  <p className="text-sm text-slate-500">Practice with your own question</p>
                </div>
              </button>

              {/* Custom Questions List - Now using filteredQuestions */}
              {filteredQuestions.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => router.push(`/workshop?question_id=${q.id}`)}
                  className={`group bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col border-slate-200 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        q.task_type === 1 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {q.task_type === 1 ? 'Task 1' : 'Task 2'}
                      </span>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        Custom
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
                  
                  <p className="text-slate-600 text-sm line-clamp-4 mb-4 flex-grow font-serif">
                    {q.content}
                  </p>
                  
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                    {/* Left: Main Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // For Custom Questions, we now use ID based navigation too, as they are real questions
                        router.push(`/workshop?question_id=${q.id}`);
                      }}
                      className={`text-sm font-bold flex items-center gap-1 transition-colors text-slate-700 hover:text-slate-900`}
                    >
                      Start Rewrite
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Right: History Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (q.essayGroup) {
                          setSelectedGroup(q.essayGroup);
                        }
                      }}
                      disabled={!q.essayGroup}
                      className={`text-xs font-medium flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                        q.essayGroup
                          ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                          : 'text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      {q.essayGroup ? 'History' : 'No History'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Standard Question Grid */}
          {activeTab !== 'custom' && (
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
                  
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                    {/* Left: Main Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuestionClick(q.id);
                      }}
                      className={`text-sm font-bold flex items-center gap-1 transition-colors ${
                        taskType === 1 ? 'text-blue-600 hover:text-blue-700' : 'text-purple-600 hover:text-purple-700'
                      }`}
                    >
                      {q.essayGroup ? 'Start Rewrite' : 'Start Practice'}
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Right: History Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (q.essayGroup) {
                          setSelectedGroup(q.essayGroup);
                        }
                      }}
                      disabled={!q.essayGroup}
                      className={`text-xs font-medium flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                        q.essayGroup
                          ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                          : 'text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      {q.essayGroup ? 'History' : 'No History'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No Task {taskType} questions found matching your filters.
              </div>
            )}
          </div>
          )}
        </>
      )}
      
      <HistoryDrawer 
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        group={selectedGroup}
      />
    </div>
  );
}

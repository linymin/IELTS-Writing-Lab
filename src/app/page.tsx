'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  BookOpen, 
  BarChart2, 
  History, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw,
  FileText,
  TrendingUp,
  AlertTriangle,
  Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EvaluationResponse } from '@/types/ielts';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Sidebar = () => (
  <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 flex flex-col z-10">
    <div className="flex items-center gap-3 mb-10">
      <BookOpen className="w-8 h-8 text-blue-400" />
      <span className="text-xl font-bold tracking-tight">IELTS Prep AI</span>
    </div>
    <nav className="flex-1 space-y-2">
      <NavItem icon={<BarChart2 />} label="Dashboard" active />
      <NavItem icon={<History />} label="History" />
      <NavItem icon={<FileText />} label="Resources" />
      <NavItem icon={<Settings />} label="Settings" />
    </nav>
    <div className="text-slate-500 text-sm">v1.0.0 (Beta)</div>
  </div>
);

const NavItem = ({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) => (
  <div className={cn(
    "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors",
    active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
  )}>
    {icon}
    <span>{label}</span>
  </div>
);

const ScoreCard = ({ title, score, color }: { title: string; score: number; color: string }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center min-w-[120px]">
    <span className="text-slate-500 text-sm font-medium mb-2">{title}</span>
    <div className={cn("text-4xl font-bold", color)}>{score.toFixed(1)}</div>
  </div>
);

const ProgressBar = ({ label, score, color, subScores }: { label: string; score: number; color: string; subScores?: Record<string, number> }) => (
  <div className="mb-6">
    <div className="flex justify-between mb-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="text-sm font-bold text-slate-900">{score.toFixed(1)}</span>
    </div>
    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
      <div 
        className={cn("h-2.5 rounded-full transition-all duration-1000", color)} 
        style={{ width: `${(score / 9) * 100}%` }}
      ></div>
    </div>
    {subScores && (
      <div className="flex flex-wrap gap-2">
        {Object.entries(subScores).map(([key, val]) => (
          <span key={key} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
            {key.replace(/_/g, ' ')}: {val}
          </span>
        ))}
      </div>
    )}
  </div>
);

const CorrectionItem = ({ 
  original, 
  correction, 
  explanation, 
  onClick 
}: { 
  original: string; 
  correction: string; 
  explanation: string;
  onClick: () => void;
}) => (
  <div 
    onClick={onClick}
    className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
  >
    <div className="space-y-1">
      <div className="text-xs font-semibold text-red-500 uppercase tracking-wider group-hover:text-red-600">Original</div>
      <p className="text-slate-600 line-through decoration-red-300 decoration-2 group-hover:text-slate-800">{original}</p>
    </div>
    <div className="space-y-1">
      <div className="text-xs font-semibold text-green-500 uppercase tracking-wider group-hover:text-green-600">Correction</div>
      <p className="text-slate-800 font-medium">{correction}</p>
      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
        <AlertCircle className="w-3 h-3 mt-0.5" /> {explanation}
      </p>
    </div>
  </div>
);

// --- Main Page ---

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // Refs for scroll and export
  const reportRef = useRef<HTMLDivElement>(null);
  const essayDisplayRef = useRef<HTMLDivElement>(null);

  // Auto-login logic
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const email = `user_${Date.now()}@temp.ielts`;
        await supabase.auth.signUp({ email, password: 'TempPassword123!' });
      }
    };
    initAuth();
  }, []);

  // Simulated loading steps
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev < 95 ? prev + Math.random() * 10 : prev));
      }, 500);
      return () => clearInterval(interval);
    } else {
      setLoadingStep(0);
    }
  }, [loading]);

  const handleEvaluate = async () => {
    if (!essay.trim() || essay.length < 50) {
      setError("Essay is too short. Please write at least 50 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          essay_body: essay,
          task_type: taskType,
          question_text: topic 
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Evaluation failed');

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setEssay('');
    setError(null);
  };

  // Feature 1: Interactive Highlighting
  const highlightSentence = (sentence: string) => {
    if (!essayDisplayRef.current) return;
    
    // Simple text find and scroll (MVP)
    // In a real app, we'd wrap sentences in <span> tags during rendering
    const container = essayDisplayRef.current;
    const text = container.innerText;
    const index = text.indexOf(sentence);
    
    if (index >= 0) {
      // Create a temporary highlight effect using Selection API or just scrolling
      // For MVP, we'll just scroll the container to roughly the right spot
      // A better way needs precise DOM mapping
      alert(`Highlighting: "${sentence.substring(0, 20)}..." (Scroll feature pending DOM mapping)`);
      container.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Feature 3: PDF Export
  const downloadPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('ielts-report.pdf');
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const radarData = result ? [
    { subject: 'TR', A: result.TR.band, fullMark: 9 },
    { subject: 'CC', A: result.CC.band, fullMark: 9 },
    { subject: 'LR', A: result.LR.band, fullMark: 9 },
    { subject: 'GRA', A: result.GRA.band, fullMark: 9 },
  ] : [];

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
      <Sidebar />
      
      <main className="ml-64 p-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Writing Evaluation</h1>
            <p className="text-slate-500 mt-1">Get instant, AI-powered feedback on your IELTS essays.</p>
          </div>
          {result && (
             <button 
               onClick={handleReset}
               className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
             >
               <RefreshCw className="w-4 h-4" /> New Essay
             </button>
          )}
        </header>

        {/* Input Mode */}
        {!result && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in fade-in zoom-in duration-300">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Essay Topic (Question)</label>
              <textarea
                className="w-full h-24 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-slate-700 text-lg leading-relaxed font-serif"
                placeholder="Paste the IELTS question here..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Task Type</label>
              <div className="flex gap-4">
                <button 
                  onClick={() => setTaskType('task1')}
                  className={cn("px-4 py-2 rounded-lg border text-sm font-medium transition-all", taskType === 'task1' ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  Task 1 (Report)
                </button>
                <button 
                  onClick={() => setTaskType('task2')}
                  className={cn("px-4 py-2 rounded-lg border text-sm font-medium transition-all", taskType === 'task2' ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  Task 2 (Essay)
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Your Essay</label>
              <textarea
                className="w-full h-64 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-slate-700 text-lg leading-relaxed font-serif"
                placeholder="Paste your essay here..."
                value={essay}
                onChange={(e) => setEssay(e.target.value)}
              />
              <div className="flex justify-between mt-2 text-sm text-slate-400">
                <span>Min. 50 characters</span>
                <span>{essay.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error}
              </div>
            )}

            <button
              onClick={handleEvaluate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              Start Evaluation <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center animate-pulse">
             <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center">
               <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
             </div>
             <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing your essay...</h2>
             <p className="text-slate-500 mb-8">Our AI examiner is checking your vocabulary, grammar, and coherence.</p>
             
             <div className="max-w-md mx-auto">
               <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${loadingStep}%` }}></div>
               </div>
               <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                 <span>Analyzing Structure</span>
                 <span>Checking Grammar</span>
                 <span>Scoring</span>
               </div>
             </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !loading && (
          <div ref={reportRef} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-4">
            
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                <span className="text-blue-100 font-medium mb-1">Overall Band</span>
                <span className="text-6xl font-bold tracking-tighter">{result.overall_band}</span>
                <div className="mt-4 px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                  {result.estimated_word_band ? `Est. Level: ${result.estimated_word_band}` : 'Good Attempt'}
                </div>
              </div>

              <div className="md:col-span-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex">
                <div className="flex-1 pr-8 border-r border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-slate-400" /> Band Breakdown
                  </h3>
                  <div className="grid grid-cols-1 gap-y-4">
                    <ProgressBar label="Task Response" score={result.TR.band} color="bg-emerald-500" subScores={result.TR.sub_scores} />
                    <ProgressBar label="Coherence & Cohesion" score={result.CC.band} color="bg-blue-500" subScores={result.CC.sub_scores} />
                    <ProgressBar label="Lexical Resource" score={result.LR.band} color="bg-purple-500" subScores={result.LR.sub_scores} />
                    <ProgressBar label="Grammar Range" score={result.GRA.band} color="bg-orange-500" subScores={result.GRA.sub_scores} />
                  </div>
                </div>
                {/* Feature 2: Radar Chart */}
                <div className="w-64 h-64 flex-shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Radar
                        name="Score"
                        dataKey="A"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Strengths & Weaknesses */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" /> Detailed Analysis
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 gap-8">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" /> Detailed Feedback
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <strong className="text-emerald-700 block mb-1">Task Response</strong>
                          <p className="text-sm text-slate-600">{result.TR.reason}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <strong className="text-blue-700 block mb-1">Coherence & Cohesion</strong>
                          <p className="text-sm text-slate-600">{result.CC.reason}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <strong className="text-purple-700 block mb-1">Lexical Resource</strong>
                          <p className="text-sm text-slate-600">{result.LR.reason}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <strong className="text-orange-700 block mb-1">Grammatical Range</strong>
                          <p className="text-sm text-slate-600">{result.GRA.reason}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Original Text Reference (Hidden for print, visible for interaction) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Your Essay</h3>
                  <div 
                    ref={essayDisplayRef}
                    className="prose prose-slate max-w-none text-slate-600 font-serif whitespace-pre-wrap leading-relaxed p-4 bg-slate-50 rounded-lg"
                  >
                    {essay}
                  </div>
                </div>

                {/* Corrections */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-purple-600" /> Smart Corrections
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {result.corrected_sentences.length > 0 ? (
                      result.corrected_sentences.map((item, i) => (
                        <CorrectionItem 
                          key={i} 
                          original={item.original} 
                          correction={item.correction} 
                          explanation={item.explanation}
                          onClick={() => highlightSentence(item.original)}
                        />
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        No major grammar errors detected. Good job!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar: Tips (Hidden as schema changed, or we extract from reasons) */}
              {/* <div className="lg:col-span-1">...</div> */}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

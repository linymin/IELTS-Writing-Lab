'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AlertCircle, 
  RefreshCw,
  FileText,
  TrendingUp,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  LayoutList,
  Sparkles,
  Highlighter,
  ScrollText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import { IELTSReport, CorrectedSentence, SubItemEvaluation, ParagraphRewrite } from '@/lib/score-adapter';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ProgressBar = ({ label, score, color, subItems }: { label: string; score: number; color: string; subItems?: Record<string, SubItemEvaluation> }) => (
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
    {subItems && (
      <div className="flex flex-wrap gap-2">
        {Object.entries(subItems).map(([key, val]) => (
          <div key={key} className="group relative">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded cursor-help">
              {key.replace(/([A-Z])/g, ' $1').trim()}: {val.score}
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              {val.reason}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OutlineRenderer = ({ outline }: { outline: string }) => {
  if (!outline) return null;
  
  const lines = outline.split('\n').map(l => l.trim()).filter(Boolean);
  const headerLine = !lines[0].match(/^(\d+\.|-|\*)/) ? lines[0] : null;
  const bodyLines = headerLine ? lines.slice(1) : lines;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
       {headerLine && (
        <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100">
          <span className="font-bold text-slate-800 text-sm block">{headerLine.replace(/:$/, '')}</span>
        </div>
      )}
      <div className="p-5 space-y-4">
        {bodyLines.map((line, i) => {
          // Match "1. Title: Content"
          const match = line.match(/^(\d+\.|-|\*|[a-z]\.)?\s*([^:]+):(.*)$/);
          
          if (match) {
             const [_, prefix, label, content] = match;
             return (
               <div key={i} className="flex gap-3">
                 <div className="flex-shrink-0 mt-0.5">
                   <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                     {prefix ? prefix.replace(/[.-]/g, '') : i + 1}
                   </div>
                 </div>
                 <div>
                   <h6 className="text-sm font-bold text-slate-900 mb-1">{label.trim()}</h6>
                   <p className="text-sm text-slate-600 leading-relaxed">{content.trim()}</p>
                 </div>
               </div>
             )
          }
          
          // Fallback for lines without colons
          return (
             <div key={i} className="flex gap-3">
                 <div className="flex-shrink-0 mt-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                 </div>
                 <p className="text-sm text-slate-600 leading-relaxed">{line}</p>
             </div>
          );
        })}
      </div>
    </div>
  );
};

const ReferenceEssayRenderer = ({ essay }: { essay: string }) => {
  if (!essay) return null;
  
  const paragraphs = essay.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Improved Model Answer
        </span>
        <span className="text-xs text-slate-500 bg-slate-200/50 px-2 py-1 rounded">
          {essay.split(/\s+/).length} words
        </span>
      </div>
      <div className="p-6 space-y-4">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-slate-700 leading-relaxed font-serif text-lg">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
};

// --- Inline Revision Components ---

interface InlineEssayProps {
  essay: string;
  corrections: CorrectedSentence[];
  paragraphRewrites?: ParagraphRewrite[];
}

const PopoverCard = ({ 
  data, 
  position,
  onClose 
}: { 
  data: CorrectedSentence; 
  position: { top: number; left: number };
  onClose: () => void;
}) => {
  return (
    <div 
      className="absolute z-50 w-80 bg-white rounded-xl shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
      style={{ top: position.top + 10, left: Math.min(position.left, window.innerWidth - 340) }} // Simple boundary check
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                 <AlertCircle className="w-3 h-3 text-red-600" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Examiner's Feedback</span>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        {/* Correction */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-100 mb-3">
          <span className="text-[10px] font-bold text-green-700 uppercase mb-1 block">Better Version</span>
          <p className="text-slate-800 font-medium text-sm">{data.correction}</p>
        </div>

        {/* Explanation */}
        <div className="mb-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Why?</span>
          <p className="text-slate-600 text-xs leading-relaxed">{data.explanation}</p>
        </div>
      </div>
    </div>
  );
};

const ParagraphRenderer = ({ 
  text, 
  corrections, 
  feedback, 
  onSentenceClick 
}: { 
  text: string; 
  corrections: CorrectedSentence[]; 
  feedback?: ParagraphRewrite;
  onSentenceClick: (e: React.MouseEvent, data: CorrectedSentence) => void;
}) => {
  
  const segments = useMemo(() => {
    if (!text) return [];
    
    // Local matching within paragraph
    const matches: { start: number; end: number; data: CorrectedSentence }[] = [];
    
    corrections.forEach(c => {
      if (!c.original || c.original.length < 3) return; 
      let start = 0;
      let idx;
      while ((idx = text.indexOf(c.original, start)) !== -1) {
        matches.push({ start: idx, end: idx + c.original.length, data: c });
        start = idx + 1; 
      }
    });

    matches.sort((a, b) => a.start - b.start);

    // Filter overlaps
    const uniqueMatches: typeof matches = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        uniqueMatches.push(m);
        lastEnd = m.end;
      }
    }

    // Build segments
    const finalSegments: { type: 'text' | 'correction'; content: string; data?: CorrectedSentence }[] = [];
    let cursor = 0;

    for (const m of uniqueMatches) {
      if (m.start > cursor) {
        finalSegments.push({ type: 'text', content: text.substring(cursor, m.start) });
      }
      finalSegments.push({ type: 'correction', content: text.substring(m.start, m.end), data: m.data });
      cursor = m.end;
    }

    if (cursor < text.length) {
      finalSegments.push({ type: 'text', content: text.substring(cursor) });
    }

    return finalSegments;
  }, [text, corrections]);

  return (
    <div className="mb-8 group">
      {/* 1. Paragraph Suggestion Inline */}
      {feedback && (
        <div className="mb-4 animate-in fade-in slide-in-from-left-2 duration-500">
           <div className="inline-block bg-blue-50/80 border-l-4 border-blue-400 rounded-r-lg p-3 max-w-3xl">
              <div className="flex items-start gap-2">
                 <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                 <div>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide block mb-1">
                      Paragraph Strategy
                    </span>
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {feedback.critique}
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 2. Paragraph Text */}
      <p className="text-lg leading-loose font-serif text-slate-700 whitespace-pre-wrap">
        {segments.map((segment, i) => {
          if (segment.type === 'text') return <span key={i}>{segment.content}</span>;
          
          return (
            <span 
              key={i}
              onClick={(e) => segment.data && onSentenceClick(e, segment.data)}
              className="cursor-pointer border-b-2 border-red-300 bg-yellow-100/50 hover:bg-yellow-200 transition-colors duration-200 decoration-skip-ink-none"
            >
              {segment.content}
            </span>
          );
        })}
      </p>
    </div>
  );
};

const InlineEssayRenderer = ({ essay, corrections, paragraphRewrites = [] }: InlineEssayProps) => {
  const [popover, setPopover] = useState<{ data: CorrectedSentence; position: { top: number; left: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = () => setPopover(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSentenceClick = (e: React.MouseEvent, data: CorrectedSentence) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setPopover({
      data,
      position: {
        top: targetRect.bottom - containerRect.top, // Relative to container
        left: targetRect.left - containerRect.left
      }
    });
  };

  // Split essay into paragraphs
  const paragraphs = useMemo(() => {
     return essay ? essay.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];
  }, [essay]);

  return (
    <div ref={containerRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm relative min-h-[400px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" /> 
          Essay Review
        </h3>
        <span className="text-xs text-slate-400">Click highlighted sentences for feedback</span>
      </div>
      
      <div className="p-8">
         {paragraphs.map((para, i) => (
           <ParagraphRenderer 
             key={i}
             text={para}
             corrections={corrections}
             feedback={paragraphRewrites[i]} // Map by index
             onSentenceClick={handleSentenceClick}
           />
         ))}
      </div>

      {/* Pop-over Card */}
      {popover && (
        <PopoverCard 
          data={popover.data} 
          position={popover.position} 
          onClose={() => setPopover(null)} 
        />
      )}
    </div>
  );
};

interface EvaluationReportProps {
  result: IELTSReport;
  essay: string;
  onReset?: () => void;
  rewriteLink?: string;
}

export default function EvaluationReport({ result, essay, onReset, rewriteLink }: EvaluationReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

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
    { subject: result.taskType === 'task1' ? 'TA' : 'TR', A: result.dimensions.taskResponse.score, fullMark: 9 },
    { subject: 'CC', A: result.dimensions.coherenceCohesion.score, fullMark: 9 },
    { subject: 'LR', A: result.dimensions.lexicalResource.score, fullMark: 9 },
    { subject: 'GRA', A: result.dimensions.grammaticalRangeAccuracy.score, fullMark: 9 },
  ] : [];

  return (
    <div className="space-y-6">
        {/* Header with New Essay Button */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-900">Evaluation Result</h2>
            <div className="flex gap-2">
                 {/* Export Button Placeholder if needed */}
                 {rewriteLink && (
                    <Link 
                      href={rewriteLink}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4" /> Rewrite & Improve
                    </Link>
                 )}
                 {onReset && (
                    <button 
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                    <RefreshCw className="w-4 h-4" /> New Essay
                    </button>
                 )}
            </div>
        </div>

      <div ref={reportRef} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-4 rounded-xl">
        
        {/* 1. Hero Section: Overall + Radar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Overall Score (1/3) */}
          <div className="md:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 flex flex-col items-center justify-center relative overflow-hidden min-h-[280px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-10 -mb-10"></div>
            
            <span className="text-blue-100 font-medium mb-2 uppercase tracking-wide text-sm">Overall Band</span>
            <span className="text-7xl font-bold tracking-tighter mb-2">{result.overallScore}</span>
            <div className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm border border-white/10">
              {result.estimatedWordBand ? `Est. Level: ${result.estimatedWordBand}` : 'Good Attempt'}
            </div>
          </div>

          {/* Radar Chart (2/3) */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center justify-center min-h-[280px]">
            <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2 self-start px-4">Performance Radar</h3>
            <div className="w-full h-full max-w-md flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                  <Radar
                    name="Score"
                    dataKey="A"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 2. Detail Grid: 4 Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Task Response */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <ProgressBar label={result.taskType === 'task1' ? "Task Achievement" : "Task Response"} score={result.dimensions.taskResponse.score} color="bg-emerald-500" subItems={result.dimensions.taskResponse.subItems} />
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-slate-600 text-sm leading-relaxed">{result.dimensions.taskResponse.reason}</p>
            </div>
          </div>

          {/* Coherence & Cohesion */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <ProgressBar label="Coherence & Cohesion" score={result.dimensions.coherenceCohesion.score} color="bg-blue-500" subItems={result.dimensions.coherenceCohesion.subItems} />
            <div className="mt-4 pt-4 border-t border-slate-100">
               <p className="text-slate-600 text-sm leading-relaxed">{result.dimensions.coherenceCohesion.reason}</p>
            </div>
          </div>

          {/* Lexical Resource */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <ProgressBar label="Lexical Resource" score={result.dimensions.lexicalResource.score} color="bg-purple-500" subItems={result.dimensions.lexicalResource.subItems} />
            <div className="mt-4 pt-4 border-t border-slate-100">
               <p className="text-slate-600 text-sm leading-relaxed">{result.dimensions.lexicalResource.reason}</p>
            </div>
          </div>

          {/* Grammatical Range */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <ProgressBar label="Grammar Range" score={result.dimensions.grammaticalRangeAccuracy.score} color="bg-orange-500" subItems={result.dimensions.grammaticalRangeAccuracy.subItems} />
            <div className="mt-4 pt-4 border-t border-slate-100">
               <p className="text-slate-600 text-sm leading-relaxed">{result.dimensions.grammaticalRangeAccuracy.reason}</p>
            </div>
          </div>
        </div>

        {/* 3. Essay Review & Toolkit */}
        <div className="space-y-6">
           <InlineEssayRenderer 
              essay={essay} 
              corrections={result.correctedSentences || []} 
              paragraphRewrites={result.paragraphRewrites}
            />

            {/* Toolkit */}
            <details className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <summary className="p-6 cursor-pointer hover:bg-slate-50 transition-colors list-none flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" /> High-Score Toolkit
                  </h3>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
               </summary>
               <div className="p-6 pt-0 border-t border-slate-100 space-y-6">
                  {result.toolkit && (
                    <Tabs defaultValue="outline" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="outline" className="flex items-center gap-2">
                          <LayoutList className="w-4 h-4" /> Outline
                        </TabsTrigger>
                        <TabsTrigger value="vocab" className="flex items-center gap-2">
                          <Highlighter className="w-4 h-4" /> Vocabulary
                        </TabsTrigger>
                        <TabsTrigger value="grammar" className="flex items-center gap-2">
                          <ScrollText className="w-4 h-4" /> Grammar
                        </TabsTrigger>
                        <TabsTrigger value="reference" className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Model Essay
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="outline" className="mt-0">
                        <OutlineRenderer outline={result.toolkit.essayOutline} />
                      </TabsContent>
                      
                      <TabsContent value="vocab" className="mt-0">
                         <div className="grid md:grid-cols-2 gap-4">
                           {(result.toolkit.vocabulary || []).map((v, i) => (
                             <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                               <div className="flex justify-between items-start mb-2">
                                 <span className="font-bold text-slate-800 text-lg">{v.word}</span>
                                 {/* Optional: Add usage context tag if available */}
                               </div>
                               <p className="text-sm text-slate-600 mb-2">{v.definition}</p>
                               {v.context && (
                                 <div className="text-xs bg-slate-50 text-slate-500 p-2 rounded italic">
                                   "{v.context}"
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                      </TabsContent>
                      
                      <TabsContent value="grammar" className="mt-0">
                         <div className="grid gap-4">
                           {(result.toolkit.grammar || []).map((g, i) => (
                             <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                               <div className="flex items-center gap-2 mb-3">
                                 <span className="font-bold text-slate-800">{g.type}</span>
                                 <div className="h-px flex-1 bg-slate-100"></div>
                               </div>
                               <div className="grid md:grid-cols-2 gap-4">
                                 <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                   <span className="text-[10px] uppercase font-bold text-blue-600 block mb-1">Example</span>
                                   <code className="text-sm text-blue-900 font-medium">{g.example}</code>
                                 </div>
                                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                   <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Why it works</span>
                                   <p className="text-sm text-slate-600">{g.explanation}</p>
                                 </div>
                               </div>
                             </div>
                           ))}
                           
                           {/* Cohesion Section */}
                           {result.toolkit.cohesion && result.toolkit.cohesion.length > 0 && (
                             <div className="mt-4">
                               <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                 <TrendingUp className="w-4 h-4 text-emerald-500" /> Cohesion Strategy
                               </h4>
                               <div className="grid gap-3">
                                 {result.toolkit.cohesion.map((c, i) => (
                                   <div key={i} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex gap-4 items-start">
                                     <div className="flex-shrink-0 mt-1">
                                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                     </div>
                                     <div>
                                        <span className="font-bold text-emerald-900 text-sm block mb-1">{c.type}</span>
                                        <p className="text-sm text-emerald-800 mb-2">{c.suggestion}</p>
                                        <code className="text-xs bg-white/50 px-2 py-1 rounded text-emerald-700 block w-fit">
                                          {c.example}
                                        </code>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                      </TabsContent>
                      
                      <TabsContent value="reference" className="mt-0">
                        {result.referenceEssay ? (
                          <ReferenceEssayRenderer essay={result.referenceEssay} />
                        ) : (
                          <div className="text-center p-8 text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Reference essay not available for this evaluation.
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
               </div>
            </details>
        </div>
      </div>
    </div>
  );
}

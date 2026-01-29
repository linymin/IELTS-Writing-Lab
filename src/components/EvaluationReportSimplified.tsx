'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  AlertCircle, 
  TrendingUp,
  MessageSquare,
  BookOpen,
  FileText,
  LayoutList,
  Sparkles,
  Highlighter,
  ScrollText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IELTSReport, CorrectedSentence, ParagraphRewrite } from '@/lib/score-adapter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

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

// Simplified Progress Bar without sub-items
const SimpleProgressBar = ({ label, score, color, reason }: { label: string; score: number; color: string; reason?: string }) => (
  <div className="mb-6">
    <div className="flex justify-between mb-1 items-center">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="text-sm font-bold text-slate-900">{score.toFixed(1)}</span>
    </div>
    <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
      <div 
        className={cn("h-2 rounded-full transition-all duration-1000", color)} 
        style={{ width: `${(score / 9) * 100}%` }}
      ></div>
    </div>
    {reason && (
      <div className="bg-white/50 rounded-lg p-2 border border-slate-100/50">
        <p className="text-xs text-slate-600 leading-relaxed">
          {reason}
        </p>
      </div>
    )}
  </div>
);

// --- Inline Revision Components (Reused from EvaluationReport but simplified if needed) ---
// We can actually import these if we exported them, but for now I'll duplicate the logic to ensure isolation 
// or minimal changes. However, to avoid code duplication, we could extract them. 
// Given the prompt "Simplified version", I will keep the Inline rendering logic as it's crucial for feedback.

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
      style={{ top: position.top + 10, left: Math.min(position.left, window.innerWidth - 340) }} 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                 <AlertCircle className="w-3 h-3 text-red-600" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Feedback</span>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="bg-green-50 rounded-lg p-3 border border-green-100 mb-3">
          <span className="text-[10px] font-bold text-green-700 uppercase mb-1 block">Better Version</span>
          <p className="text-slate-800 font-medium text-sm">{data.correction}</p>
        </div>

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

    const uniqueMatches: typeof matches = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        uniqueMatches.push(m);
        lastEnd = m.end;
      }
    }

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
      {feedback && (
        <div className="mb-4 animate-in fade-in slide-in-from-left-2 duration-500">
           <div className="inline-block bg-blue-50/80 border-l-4 border-blue-400 rounded-r-lg p-3 max-w-2xl">
              <div className="flex items-start gap-2">
                 <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                 <div>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide block mb-1">
                      Strategy
                    </span>
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {feedback.critique}
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      <p className="text-base leading-loose font-serif text-slate-700 whitespace-pre-wrap">
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

const InlineEssayRenderer = ({ essay, corrections, paragraphRewrites = [] }: { essay: string; corrections: CorrectedSentence[]; paragraphRewrites?: ParagraphRewrite[] }) => {
  const [popover, setPopover] = useState<{ data: CorrectedSentence; position: { top: number; left: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        top: targetRect.bottom - containerRect.top,
        left: targetRect.left - containerRect.left
      }
    });
  };

  const paragraphs = useMemo(() => {
     return essay ? essay.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];
  }, [essay]);

  return (
    <div ref={containerRef} className="bg-white rounded-xl border border-slate-200 shadow-sm relative">
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-blue-600" /> 
          Review
        </h3>
        <span className="text-[10px] text-slate-400">Click highlights for feedback</span>
      </div>
      
      <div className="p-4">
         {paragraphs.map((para, i) => (
           <ParagraphRenderer 
             key={i}
             text={para}
             corrections={corrections}
             feedback={paragraphRewrites[i]} 
             onSentenceClick={handleSentenceClick}
           />
         ))}
      </div>

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

interface EvaluationReportSimplifiedProps {
  result: IELTSReport;
  essay: string;
  mode?: string;
}

export default function EvaluationReportSimplified({ result, essay, mode }: EvaluationReportSimplifiedProps) {
  return (
    <div className="space-y-6">
      {/* 1. Score Summary (Simplified) */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-4">
             <span className="text-slate-500 text-xs font-bold uppercase">Overall Band</span>
             <span className="text-2xl font-bold text-blue-700">{result.overallScore}</span>
          </div>
          <div className="grid grid-cols-1 gap-y-2">
            <SimpleProgressBar 
              label="TR" 
              score={result.dimensions.taskResponse.score} 
              color="bg-emerald-500" 
              reason={result.dimensions.taskResponse.reason}
            />
            <SimpleProgressBar 
              label="CC" 
              score={result.dimensions.coherenceCohesion.score} 
              color="bg-blue-500" 
              reason={result.dimensions.coherenceCohesion.reason}
            />
            <SimpleProgressBar 
              label="LR" 
              score={result.dimensions.lexicalResource.score} 
              color="bg-purple-500" 
              reason={result.dimensions.lexicalResource.reason}
            />
            <SimpleProgressBar 
              label="GRA" 
              score={result.dimensions.grammaticalRangeAccuracy.score} 
              color="bg-orange-500" 
              reason={result.dimensions.grammaticalRangeAccuracy.reason}
            />
          </div>
      </div>

      {/* 2. Essay Review (The most important part for rewriting) */}
      <InlineEssayRenderer 
        essay={essay} 
        corrections={result.correctedSentences || []} 
        paragraphRewrites={result.paragraphRewrites}
      />

      {/* 3. Toolkit (High-Score Toolkit Style) */}
      <details className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" open>
          <summary className="p-4 cursor-pointer hover:bg-slate-50 transition-colors list-none flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-purple-600" /> High-Score Toolkit
            </h3>
            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-4 pt-0 border-t border-slate-100 space-y-4">
            {result.toolkit && (
              <Tabs defaultValue="outline" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="outline" className="flex items-center gap-1.5 text-xs px-1">
                    <LayoutList className="w-3 h-3" /> <span className="hidden sm:inline">Outline</span>
                  </TabsTrigger>
                  <TabsTrigger value="vocab" className="flex items-center gap-1.5 text-xs px-1">
                    <Highlighter className="w-3 h-3" /> <span className="hidden sm:inline">Vocab</span>
                  </TabsTrigger>
                  <TabsTrigger value="grammar" className="flex items-center gap-1.5 text-xs px-1">
                    <ScrollText className="w-3 h-3" /> <span className="hidden sm:inline">Grammar</span>
                  </TabsTrigger>
                  <TabsTrigger value="reference" className="flex items-center gap-1.5 text-xs px-1">
                    <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Model</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="outline" className="mt-0">
                  <OutlineRenderer outline={result.toolkit.essayOutline} />
                </TabsContent>
                
                <TabsContent value="vocab" className="mt-0">
                   <div className="grid grid-cols-1 gap-3">
                     {(result.toolkit.vocabulary || []).map((v, i) => (
                       <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                         <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-slate-800 text-sm">{v.word}</span>
                         </div>
                         <p className="text-xs text-slate-600 mb-1.5">{v.definition}</p>
                         {v.context && (
                           <div className="text-[10px] bg-slate-50 text-slate-500 p-1.5 rounded italic border border-slate-100">
                             "{v.context}"
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                </TabsContent>
                
                <TabsContent value="grammar" className="mt-0">
                   <div className="grid gap-3">
                     {(result.toolkit.grammar || []).map((g, i) => (
                       <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                         <div className="flex items-center gap-2 mb-2">
                           <span className="font-bold text-slate-800 text-sm">{g.type}</span>
                           <div className="h-px flex-1 bg-slate-100"></div>
                         </div>
                         <div className="grid grid-cols-1 gap-2">
                           <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                             <span className="text-[10px] uppercase font-bold text-blue-600 block mb-0.5">Example</span>
                             <code className="text-xs text-blue-900 font-medium">{g.example}</code>
                           </div>
                           <div className="bg-slate-50 p-2 rounded border border-slate-100">
                             <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Why it works</span>
                             <p className="text-xs text-slate-600">{g.explanation}</p>
                           </div>
                         </div>
                       </div>
                     ))}
                     
                     {/* Cohesion Section */}
                     {result.toolkit.cohesion && result.toolkit.cohesion.length > 0 && (
                       <div className="mt-2">
                         <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5 text-xs">
                           <TrendingUp className="w-3 h-3 text-emerald-500" /> Cohesion Strategy
                         </h4>
                         <div className="grid gap-2">
                           {result.toolkit.cohesion.map((c, i) => (
                             <div key={i} className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex gap-3 items-start">
                               <div className="flex-shrink-0 mt-1">
                                 <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                               </div>
                               <div>
                                  <span className="font-bold text-emerald-900 text-xs block mb-0.5">{c.type}</span>
                                  <p className="text-xs text-emerald-800 mb-1">{c.suggestion}</p>
                                  <code className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded text-emerald-700 block w-fit">
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
                    <div className="text-center p-6 text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                      Reference essay not available.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
      </details>
    </div>
  );
}

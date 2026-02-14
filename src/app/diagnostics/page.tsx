'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  BarChart3, 
  ChevronRight,
  Award,
  BookOpen,
  LineChart as LineChartIcon,
  Activity,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const supabase = createClient();

// --- Types ---
interface EvaluationRecord {
  id: string;
  overall_score: number;
  dimensions: {
    TR: number;
    CC: number;
    LR: number;
    GRA: number;
  };
  created_at: string;
  task_type: 'task1' | 'task2';
  topic?: string;
  question_type?: string;
}

interface QuestionRecommendation {
  id: string;
  content: string;
  topic: string;
  question_type: string;
}

// --- Components ---

const StatCard = ({ title, value, subValue, icon: Icon, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-blue-50 rounded-lg">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      {trend && (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <div className="flex items-baseline gap-2 mt-1">
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {subValue && <span className="text-slate-400 text-xs">{subValue}</span>}
    </div>
  </div>
);

const SectionHeader = ({ title, subtitle, icon: Icon }: any) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2 bg-slate-900 rounded-lg">
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-500 text-sm">{subtitle}</p>
    </div>
  </div>
);

export default function DiagnosticsPage() {
  const router = useRouter();
  const [data, setData] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<QuestionRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Query essays with linked questions to get topic and question_type
      const { data: essays, error } = await supabase
        .from('essays')
        .select(`
          id,
          task_type,
          submitted_at,
          questions (
            topic,
            question_type
          ),
          evaluations (
            id,
            overall_band,
            band_scores,
            created_at
          )
        `)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      const formatted = essays
        .filter(e => e.evaluations && (Array.isArray(e.evaluations) ? e.evaluations.length > 0 : e.evaluations))
        .map(e => {
          const eval_ = Array.isArray(e.evaluations) ? e.evaluations[0] : e.evaluations;
          const question = Array.isArray(e.questions) ? e.questions[0] : e.questions;
          
          return {
            id: eval_.id,
            overall_score: Number(eval_.overall_band),
            dimensions: eval_.band_scores as unknown as EvaluationRecord['dimensions'],
            created_at: e.submitted_at,
            task_type: e.task_type as 'task1' | 'task2',
            topic: question?.topic || 'Uncategorized',
            question_type: question?.question_type || 'General'
          };
        });

      setData(formatted);
    } catch (err) {
      console.error(err);
      setError('Failed to load diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const avg = data.reduce((acc, curr) => acc + curr.overall_score, 0) / data.length;
    const best = Math.max(...data.map(d => d.overall_score));
    
    // Calculate Dimension Averages
    const dimSums = data.reduce((acc, curr) => ({
      TR: acc.TR + (curr.dimensions.TR || 0),
      CC: acc.CC + (curr.dimensions.CC || 0),
      LR: acc.LR + (curr.dimensions.LR || 0),
      GRA: acc.GRA + (curr.dimensions.GRA || 0),
    }), { TR: 0, CC: 0, LR: 0, GRA: 0 });

    const dimAvgs = {
      TR: Number((dimSums.TR / data.length).toFixed(1)),
      CC: Number((dimSums.CC / data.length).toFixed(1)),
      LR: Number((dimSums.LR / data.length).toFixed(1)),
      GRA: Number((dimSums.GRA / data.length).toFixed(1)),
    };

    const radarData = [
      { subject: 'Task Response', A: dimAvgs.TR, fullMark: 9 },
      { subject: 'Coherence', A: dimAvgs.CC, fullMark: 9 },
      { subject: 'Lexical', A: dimAvgs.LR, fullMark: 9 },
      { subject: 'Grammar', A: dimAvgs.GRA, fullMark: 9 },
    ];

    const chartData = data.map(d => ({
      date: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: d.overall_score,
      ...d.dimensions
    }));

    // Weakest Area (Dimension)
    const sortedDims = Object.entries(dimAvgs).sort(([,a], [,b]) => a - b);
    const weakestDimension = sortedDims[0][0] as keyof typeof dimAvgs;

    // --- New: Question Type Analysis ---
    const typeStats: Record<string, { total: number, count: number }> = {};
    data.forEach(d => {
      const type = d.question_type || 'General';
      if (!typeStats[type]) typeStats[type] = { total: 0, count: 0 };
      typeStats[type].total += d.overall_score;
      typeStats[type].count += 1;
    });

    const typeChartData = Object.entries(typeStats)
      .map(([name, stat]) => ({
        name,
        score: Number((stat.total / stat.count).toFixed(1)),
        count: stat.count
      }))
      .sort((a, b) => b.score - a.score);

    // --- New: Topic Analysis for Weakest Topic ---
    const topicStats: Record<string, { total: number, count: number }> = {};
    data.forEach(d => {
      const topic = d.topic || 'Uncategorized';
      // Skip custom topics if we want to recommend official questions, 
      // or keep them if we just want to know performance.
      if (topic === 'Custom Topic') return; 
      
      if (!topicStats[topic]) topicStats[topic] = { total: 0, count: 0 };
      topicStats[topic].total += d.overall_score;
      topicStats[topic].count += 1;
    });

    let weakestTopic = null;
    if (Object.keys(topicStats).length > 0) {
      const sortedTopics = Object.entries(topicStats).sort(([,a], [,b]) => (a.total/a.count) - (b.total/b.count));
      weakestTopic = sortedTopics[0][0];
    }

    return { avg: avg.toFixed(1), best, dimAvgs, radarData, chartData, weakestDimension, typeChartData, weakestTopic };
  }, [data]);

  // Fetch Recommendations when weakest topic is identified
  useEffect(() => {
    if (stats?.weakestTopic) {
      fetchRecommendations(stats.weakestTopic);
    }
  }, [stats?.weakestTopic]);

  const fetchRecommendations = async (topic: string) => {
    try {
      setLoadingRecs(true);
      // Fetch 2 random questions from this topic that are NOT custom questions (user_id is null)
      const { data: recs, error } = await supabase
        .from('questions')
        .select('id, content, topic, question_type')
        .eq('topic', topic)
        .is('user_id', null) 
        .limit(2);

      if (error) throw error;
      if (recs) setRecommendations(recs as QuestionRecommendation[]);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoadingRecs(false);
    }
  };

  const getActionPlan = (weakest: string) => {
    const plans: Record<string, { title: string, steps: string[] }> = {
      TR: {
        title: "Improve Task Response",
        steps: [
          "Ensure you address all parts of the prompt equally.",
          "Develop your ideas with relevant examples and explanations.",
          "Maintain a clear position throughout the entire essay.",
          "Check your word count (Task 1: >150, Task 2: >250)."
        ]
      },
      CC: {
        title: "Enhance Coherence & Cohesion",
        steps: [
          "Use a clear paragraph structure with one central idea per paragraph.",
          "Practice using a variety of cohesive devices (transition words).",
          "Ensure logical flow between sentences and paragraphs.",
          "Avoid overusing or underusing linkers."
        ]
      },
      LR: {
        title: "Expand Lexical Resource",
        steps: [
          "Use less common lexical items with precision.",
          "Focus on correct collocation (words that naturally go together).",
          "Avoid repeating the same words; use synonyms.",
          "Pay attention to spelling and word formation."
        ]
      },
      GRA: {
        title: "Boost Grammatical Range",
        steps: [
          "Incorporate a mix of simple and complex sentence structures.",
          "Work on error-free sentences to increase your score.",
          "Review punctuation usage in complex sentences.",
          "Practice using various tenses and voices correctly."
        ]
      }
    };
    return plans[weakest] || plans.TR;
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p className="text-slate-500">Analyzing your performance data...</p>
    </div>
  );

  if (data.length === 0) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Activity className="w-10 h-10 text-slate-300" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">No Diagnostic Data Yet</h1>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">Complete at least one evaluation to see your personalized progress tracking and diagnostic report.</p>
      <button 
        onClick={() => router.push('/questions')}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
      >
        Start Practice <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  const actionPlan = stats ? getActionPlan(stats.weakestDimension) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-slate-50/30 min-h-screen">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Personal Diagnostics</h1>
        <p className="text-slate-500 mt-2">Comprehensive analysis of your IELTS writing journey.</p>
      </div>

      {/* --- Current Status Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard 
          title="Average Band Score" 
          value={stats?.avg} 
          icon={Award} 
          // trend={5.2} // Hardcoded removed
        />
        <StatCard 
          title="Total Practices" 
          value={data.length} 
          icon={BookOpen} 
        />
        <StatCard 
          title="Best Score" 
          value={stats?.best} 
          icon={Target} 
        />
        <StatCard 
          title="Consistency" 
          value="High" 
          subValue="Keep it up!"
          icon={Zap} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* --- Progress Tracking (Chart) --- */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader 
            title="Progress Tracking" 
            subtitle="Overall band score improvement over time"
            icon={TrendingUp}
          />
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                  dy={10}
                />
                <YAxis 
                  domain={[0, 9]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- Dimension Breakdown (Radar) --- */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader 
            title="Skill Profile" 
            subtitle="Performance across 4 criteria"
            icon={BarChart3}
          />
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 11}} />
                <PolarRadiusAxis angle={30} domain={[0, 9]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- New Section: Question Type Performance & Smart Recommendations --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Question Type Analysis */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader 
            title="Performance by Question Type" 
            subtitle="Identify your strong and weak question types"
            icon={BarChart3}
          />
          <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={stats?.typeChartData}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" domain={[0, 9]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{fontSize: 12, fill: '#64748b'}} 
                  width={100}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                   {stats?.typeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score >= 7 ? '#10b981' : entry.score >= 6 ? '#3b82f6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Smart Recommendations */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -mr-32 -mt-32 rounded-full"></div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Smart Recommendations</h2>
                <p className="text-slate-400 text-sm">
                  {stats?.weakestTopic ? `Focus area: ${stats.weakestTopic}` : 'Keep practicing to get recommendations'}
                </p>
              </div>
            </div>

            {loadingRecs ? (
              <div className="flex-1 flex items-center justify-center">
                 <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-4 flex-1">
                <p className="text-sm text-slate-300 mb-2">We noticed you could improve on <strong>{stats?.weakestTopic}</strong>. Try these:</p>
                {recommendations.map((rec) => (
                  <div key={rec.id} className="bg-white/10 p-4 rounded-xl border border-white/10 hover:bg-white/20 transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                          {rec.question_type}
                        </span>
                        <h4 className="text-sm font-medium leading-snug line-clamp-2 mb-3">{rec.content}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push(`/workshop?question_id=${rec.id}`)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      Start Practice <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                 <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3">
                   <Target className="w-6 h-6 text-slate-400" />
                 </div>
                 <p className="text-slate-400 text-sm">Great job! Your performance is balanced across topics. Try a random challenge?</p>
                 <button 
                    onClick={() => router.push('/questions')}
                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors"
                  >
                    Go to Question Bank
                  </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Action Plan --- */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <SectionHeader 
            title="Action Plan" 
            subtitle="Targeted steps to reach your goal score"
            icon={LineChartIcon}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-4 uppercase tracking-wider">
                Priority: {actionPlan?.title.split('Improve ')[1] || stats?.weakestDimension}
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">{actionPlan?.title}</h3>
              <p className="text-slate-500 mb-6 leading-relaxed">
                Based on our analysis, your performance in <strong>{stats?.weakestDimension}</strong> is currently the main factor holding back your overall band score. Prioritizing the following steps will likely yield the fastest improvement.
              </p>
            </div>

            <div className="space-y-4">
              {actionPlan?.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors group">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-600 leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
}
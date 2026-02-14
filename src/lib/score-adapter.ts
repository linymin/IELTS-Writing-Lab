export interface IELTSDimension {
  score: number;
  explanation: string;
  subScores: Record<string, number>;
}

export interface SubItemEvaluation {
  score: number;
  reason: string;
}

export interface CorrectedSentence {
  original: string;
  correction: string;
  explanation: string;
}

export interface ParagraphRewrite {
  critique: string;
  rewrite?: string;
}

export interface VocabularyItem {
  word: string;
  definition: string;
  context?: string;
}

export interface GrammarItem {
  type: string;
  example: string;
  explanation: string;
}

export interface CohesionItem {
  type: string;
  suggestion: string;
  example: string;
}

export interface Toolkit {
  essayOutline: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  cohesion?: CohesionItem[];
}

export interface IELTSReport {
  topic: string;
  overallScore: number;
  estimatedWordBand?: string;
  taskType?: 'task1' | 'task2';
  dimensions: {
    taskResponse: {
      score: number;
      reason: string;
      subItems: Record<string, SubItemEvaluation>;
    };
    coherenceCohesion: {
      score: number;
      reason: string;
      subItems: Record<string, SubItemEvaluation>;
    };
    lexicalResource: {
      score: number;
      reason: string;
      subItems: Record<string, SubItemEvaluation>;
    };
    grammaticalRangeAccuracy: {
      score: number;
      reason: string;
      subItems: Record<string, SubItemEvaluation>;
    };
  };
  correctedSentences: CorrectedSentence[];
  paragraphRewrites: ParagraphRewrite[];
  toolkit: Toolkit;
  referenceEssay: string;
}

export function safeTransform(raw: any): IELTSReport {
  const safeObj = (val: any) => (typeof val === 'object' && val !== null ? val : {});
  const safeNum = (val: any, fallback = 0) => (typeof val === 'number' && !isNaN(val) ? val : fallback);
  const safeStr = (val: any, fallback = '') => (typeof val === 'string' ? val : fallback);
  const safeArr = <T>(val: any, transform: (item: any) => T): T[] => {
    return Array.isArray(val) ? val.map(transform) : [];
  };

  const data = safeObj(raw);

  // Helper for dimension extraction
  const getDimension = (keys: string[]) => {
    let dimData: any = {};
    for (const key of keys) {
      if (data[key] || (data.dimensions && data.dimensions[key])) {
        dimData = data[key] || data.dimensions[key];
        break;
      }
    }
    
    // Normalize subItems/subScores
    const rawSub = dimData.subItems ?? dimData.sub_scores ?? dimData.subScores ?? {};
    const subItems: Record<string, SubItemEvaluation> = {};
    
    if (typeof rawSub === 'object') {
      for (const [k, v] of Object.entries(rawSub)) {
        if (typeof v === 'object' && v !== null) {
           // @ts-ignore
           subItems[k] = { score: safeNum(v.score), reason: safeStr(v.reason ?? v.explanation) };
        } else if (typeof v === 'number') {
           subItems[k] = { score: v, reason: '' };
        }
      }
    }

    return {
      score: safeNum(dimData.score ?? dimData.band, 0),
      reason: safeStr(dimData.explanation ?? dimData.reason ?? dimData.feedback, '暂无评价'),
      subItems,
    };
  };

  // Extract Corrected Sentences
  const getCorrections = (): CorrectedSentence[] => {
    const rawList = data.correctedSentences ?? data.sentence_corrections ?? data.corrections ?? [];
    return safeArr(rawList, (item) => ({
      original: safeStr(item.original),
      correction: safeStr(item.correction ?? item.revised),
      explanation: safeStr(item.explanation ?? item.reason)
    }));
  };

  // Extract Paragraph Rewrites
  const getParagraphRewrites = (): ParagraphRewrite[] => {
    const rawList = data.paragraphRewrites ?? data.paragraph_feedback ?? data.rewrites ?? [];
    return safeArr(rawList, (item) => ({
      critique: safeStr(item.critique ?? item.feedback ?? item.analysis),
      rewrite: safeStr(item.rewrite ?? item.revised)
    }));
  };

  // Extract Toolkit
  const getToolkit = (): Toolkit => {
    const rawTk = data.toolkit ?? {};
    
    return {
      essayOutline: safeStr(rawTk.essayOutline ?? rawTk.outline ?? data.outline),
      vocabulary: safeArr(rawTk.vocabulary ?? data.vocabulary ?? [], (item) => ({
        word: safeStr(item.word),
        definition: safeStr(item.definition ?? item.meaning),
        context: safeStr(item.context ?? item.usage)
      })),
      grammar: safeArr(rawTk.grammar ?? data.grammar ?? [], (item) => ({
        type: safeStr(item.type ?? item.structure),
        example: safeStr(item.example),
        explanation: safeStr(item.explanation)
      })),
      cohesion: safeArr(rawTk.cohesion ?? data.cohesion ?? [], (item) => ({
        type: safeStr(item.type),
        suggestion: safeStr(item.suggestion),
        example: safeStr(item.example)
      }))
    };
  };

  return {
    topic: safeStr(data.topic ?? data.title ?? data.question ?? data.question_text, '未知题目'),
    overallScore: safeNum(data.overallScore ?? data.overall_band ?? data.totalScore, 0),
    estimatedWordBand: safeStr(data.estimatedWordBand ?? data.word_level),
    taskType: data.taskType ?? 'task2',
    dimensions: {
      taskResponse: getDimension(['taskResponse', 'TR', 'tr', 'TA', 'ta', 'taskAchievement']),
      coherenceCohesion: getDimension(['coherenceCohesion', 'CC', 'cc']),
      lexicalResource: getDimension(['lexicalResource', 'LR', 'lr']),
      grammaticalRangeAccuracy: getDimension(['grammaticalRangeAccuracy', 'GRA', 'gra']),
    },
    correctedSentences: getCorrections(),
    paragraphRewrites: getParagraphRewrites(),
    toolkit: getToolkit(),
    referenceEssay: safeStr(data.referenceEssay ?? data.modelEssay ?? data.sample_answer ?? data.improved_essay)
  };
}

export function formatEvaluation(raw: any, essayBody?: string, taskType?: string): IELTSReport {
  const result = safeTransform(raw);
  // Allow overriding taskType if provided explicitly
  if (taskType) {
    result.taskType = taskType as 'task1' | 'task2';
  }
  return result;
}

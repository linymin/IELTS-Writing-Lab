export interface SubItemEvaluation {
  score: number;
  reason: string;
}

export interface DimensionEvaluation {
  score: number;
  reason: string;
  subItems: Record<string, SubItemEvaluation>;
}

export interface ParagraphRewrite {
  paragraphType: 'Introduction' | 'Body Paragraph' | 'Conclusion';
  originalText?: string;
  critique: string;
  rewrite: string;
}

export interface VocabularyItem {
  word: string;
  definition: string;
  context: string;
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

export interface HighScoreToolkit {
  essayOutline: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  cohesion: CohesionItem[];
}

export interface CorrectedSentence {
  original: string;
  correction: string;
  explanation: string;
  relatedParagraphCritique?: string;
  relatedParagraphRewrite?: string;
}

export interface IELTSReport {
  topic: string;
  taskType?: 'task1' | 'task2';
  overallScore: number;
  
  // 1. Detailed Assessment Table
  dimensions: {
    taskResponse: DimensionEvaluation;
    coherenceCohesion: DimensionEvaluation;
    lexicalResource: DimensionEvaluation;
    grammaticalRangeAccuracy: DimensionEvaluation;
  };

  // 2. Paragraph Critique & Rewrite
  paragraphRewrites: ParagraphRewrite[];

  // 3. High-score Toolkit
  toolkit: HighScoreToolkit;

  // 4. Reference Essay
  referenceEssay: string;

  // Legacy field for compatibility (optional)
  correctedSentences?: CorrectedSentence[];
  estimatedWordBand?: number;
}

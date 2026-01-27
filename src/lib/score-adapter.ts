import { IELTSReport, DimensionEvaluation, ParagraphRewrite, HighScoreToolkit, SubItemEvaluation, CorrectedSentence } from '@/types/evaluation';

// Re-export types for backward compatibility with consumers like page.tsx
export type { IELTSReport, DimensionEvaluation, ParagraphRewrite, HighScoreToolkit, SubItemEvaluation, CorrectedSentence };

export function formatEvaluation(raw: any, essayBody?: string, taskType: 'task1' | 'task2' = 'task2'): IELTSReport {
  const safeObj = (val: any) => (typeof val === 'object' && val !== null ? val : {});
  const safeNum = (val: any, fallback = 0) => (typeof val === 'number' && !isNaN(val) ? val : fallback);
  const safeStr = (val: any, fallback = '') => (typeof val === 'string' ? val : fallback);
  
  const data = safeObj(raw);

  // Split essay into paragraphs if provided
  const paragraphs = essayBody ? essayBody.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];

  const getSubItem = (item: any): SubItemEvaluation => ({
    score: safeNum(item?.score, 0),
    reason: safeStr(item?.reason, '暂无评价')
  });

  const expectedSubItems: Record<string, string[]> = {
    taskResponse: taskType === 'task1' 
      ? ['overviewClarity', 'keyFeaturesSelection', 'dataAccuracySupport', 'coverage']
      : ['responseToPrompt', 'positionClarity', 'ideaDevelopment', 'exampleRelevance'],
    coherenceCohesion: ['logicalOrganization', 'introConclusionEffectiveness', 'cohesiveDevices', 'mainIdeaSupport'],
    lexicalResource: ['vocabularyRange', 'accuracy', 'spellingFormation', 'collocationIdiomaticity'],
    grammaticalRangeAccuracy: ['sentenceVariety', 'grammarAccuracy', 'punctuation', 'controlComplexity']
  };

  const getDimension = (dimData: any, dimKey: string, fallbackScore: number): DimensionEvaluation => {
    const safeDim = safeObj(dimData);
    const dimScore = safeNum(safeDim.score ?? safeDim.band, fallbackScore);
    
    // Normalize subItems keys
    const subItemsRaw = safeObj(safeDim.subItems || safeDim.sub_scores);
    
    const subItems: Record<string, SubItemEvaluation> = {};
    const requiredKeys = expectedSubItems[dimKey] || [];

    requiredKeys.forEach(key => {
      // Try to find the key (case-insensitive or direct match)
      // The prompt asks for camelCase, but we should be robust
      let foundData = subItemsRaw[key];
      
      // If not found, try to find snake_case or other variations if needed, 
      // but for now let's rely on the fallback logic if missing.
      
      // Default Value Interceptor Logic:
      // 1. If we have specific data, use it.
      // 2. If score is 0 or missing, fallback to the Dimension Score.
      // 3. If Dimension Score is 0 (unlikely with our fallbackScore passed in), fallback to 5.0.
      
      const rawScore = safeNum(foundData?.score, 0);
      const finalScore = rawScore > 0 ? rawScore : (dimScore > 0 ? dimScore : 5.0);
      
      subItems[key] = {
        score: finalScore,
        reason: safeStr(foundData?.reason, safeDim.reason ?? 'Evaluated based on dimension performance.')
      };
    });

    return {
      score: dimScore,
      reason: safeStr(safeDim.reason ?? safeDim.explanation, '暂无评价'),
      subItems
    };
  };

  const getParagraphRewrites = (list: any): ParagraphRewrite[] => {
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => ({
      paragraphType: safeStr(item.paragraphType) as 'Introduction' | 'Body Paragraph' | 'Conclusion',
      originalText: item.originalText ? safeStr(item.originalText) : undefined,
      critique: safeStr(item.critique),
      rewrite: safeStr(item.rewrite)
    }));
  };

  const paragraphRewrites = getParagraphRewrites(data.paragraphRewrites);

  const getCorrectedSentences = (list: any): CorrectedSentence[] => {
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const original = safeStr(item.original);
      const sentence = {
        original: original,
        correction: safeStr(item.correction),
        explanation: safeStr(item.explanation),
        relatedParagraphCritique: undefined as string | undefined,
        relatedParagraphRewrite: undefined as string | undefined
      };

      // Try to match sentence to a paragraph and attach feedback
      if (paragraphs.length > 0 && paragraphRewrites.length > 0) {
        // Find which paragraph contains this sentence
        const paraIndex = paragraphs.findIndex(p => p.includes(original));
        
        if (paraIndex !== -1) {
           // We found the paragraph index. 
           // Now we need to map this index to the paragraphRewrites array.
           // Assumption: The LLM returns rewrites in the same logical order (Intro -> Body 1 -> Body 2 -> Conclusion)
           // If the number of paragraphs matches rewrites, we can map 1:1. 
           // If not, we might try to match by paragraphType or just be conservative.
           
           // Heuristic: If we have equal count, map by index.
           if (paragraphs.length === paragraphRewrites.length) {
              const rewrite = paragraphRewrites[paraIndex];
              sentence.relatedParagraphCritique = rewrite.critique;
              sentence.relatedParagraphRewrite = rewrite.rewrite;
           } else {
             // Fallback: Try to guess based on index position (0 -> Intro, last -> Conclusion)
             // or just leave undefined to avoid mismatch.
             // Let's try a simpler approach: Map by type keywords if possible, or just use index if it's within bounds.
             if (paraIndex < paragraphRewrites.length) {
                 const rewrite = paragraphRewrites[paraIndex];
                 sentence.relatedParagraphCritique = rewrite.critique;
                 sentence.relatedParagraphRewrite = rewrite.rewrite;
             }
           }
        }
      }

      return sentence;
    });
  };

  const getToolkit = (tk: any): HighScoreToolkit => {
    const safeTk = safeObj(tk);
    return {
      essayOutline: safeStr(safeTk.essayOutline),
      vocabulary: Array.isArray(safeTk.vocabulary) ? safeTk.vocabulary.map((v: any) => ({
        word: safeStr(v.word),
        definition: safeStr(v.definition),
        context: safeStr(v.context)
      })) : [],
      grammar: Array.isArray(safeTk.grammar) ? safeTk.grammar.map((g: any) => ({
        type: safeStr(g.type),
        example: safeStr(g.example),
        explanation: safeStr(g.explanation)
      })) : [],
      cohesion: Array.isArray(safeTk.cohesion) ? safeTk.cohesion.map((c: any) => ({
        type: safeStr(c.type),
        suggestion: safeStr(c.suggestion),
        example: safeStr(c.example)
      })) : []
    };
  };

  const overall = safeNum(data.overallScore ?? data.overall_band, 5.0); // Default overall to 5.0 if missing

  return {
    topic: safeStr(data.topic ?? data.title ?? 'Unknown Topic'),
    taskType: taskType,
    overallScore: overall,
    dimensions: {
      taskResponse: getDimension(data.dimensions?.taskResponse ?? data.TR, 'taskResponse', overall),
      coherenceCohesion: getDimension(data.dimensions?.coherenceCohesion ?? data.CC, 'coherenceCohesion', overall),
      lexicalResource: getDimension(data.dimensions?.lexicalResource ?? data.LR, 'lexicalResource', overall),
      grammaticalRangeAccuracy: getDimension(data.dimensions?.grammaticalRangeAccuracy ?? data.GRA, 'grammaticalRangeAccuracy', overall),
    },
    paragraphRewrites: paragraphRewrites,
    toolkit: getToolkit(data.toolkit),
    referenceEssay: safeStr(data.referenceEssay),
    correctedSentences: getCorrectedSentences(data.correctedSentences ?? data.corrected_sentences ?? data.corrections), 
    estimatedWordBand: safeNum(data.estimatedWordBand, 0)
  };
}

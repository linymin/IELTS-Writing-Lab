import { z } from 'zod';

const SubItemSchema = z.object({
  score: z.number().describe('Score for this sub-dimension (0-9)'),
  reason: z.string().describe('Explanation for the score')
});

const DimensionBaseSchema = z.object({
  score: z.number().describe('Band score for this dimension (0-9)'),
  reason: z.string().describe('General feedback for this dimension')
});

// Task 1 Specific Sub-items
const Task1TRSubItems = z.object({
  overviewClarity: SubItemSchema,
  keyFeaturesSelection: SubItemSchema,
  dataAccuracySupport: SubItemSchema,
  coverage: SubItemSchema
});

// Task 2 Specific Sub-items
const Task2TRSubItems = z.object({
  responseToPrompt: SubItemSchema,
  positionClarity: SubItemSchema,
  ideaDevelopment: SubItemSchema,
  exampleRelevance: SubItemSchema
});

// Common Dimensions
const CCSubItems = z.object({
  logicalOrganization: SubItemSchema,
  introConclusionEffectiveness: SubItemSchema,
  cohesiveDevices: SubItemSchema,
  mainIdeaSupport: SubItemSchema
});

const LRSubItems = z.object({
  vocabularyRange: SubItemSchema,
  accuracy: SubItemSchema,
  spellingFormation: SubItemSchema,
  collocationIdiomaticity: SubItemSchema
});

const GRASubItems = z.object({
  sentenceVariety: SubItemSchema,
  grammarAccuracy: SubItemSchema,
  punctuation: SubItemSchema,
  controlComplexity: SubItemSchema
});

// Helper to create dimension schema with specific sub-items
const createDimensionSchema = (subItemsSchema: z.ZodTypeAny) => 
  DimensionBaseSchema.extend({
    subItems: subItemsSchema
  });

export const ToolkitSchema = z.object({
  essayOutline: z.string(),
  vocabulary: z.array(z.object({
    word: z.string(),
    definition: z.string(),
    context: z.string()
  })),
  grammar: z.array(z.object({
    type: z.string(),
    example: z.string(),
    explanation: z.string()
  })),
  cohesion: z.array(z.object({
    type: z.string(),
    suggestion: z.string(),
    example: z.string()
  }))
});

export const ParagraphRewriteSchema = z.object({
  paragraphType: z.enum(['Introduction', 'Body Paragraph', 'Conclusion']).or(z.string()),
  originalText: z.string().optional(),
  critique: z.string(),
  rewrite: z.string()
});

export const CorrectedSentenceSchema = z.object({
  original: z.string(),
  correction: z.string(),
  explanation: z.string()
});

// Schema generator function
export const getEvaluationSchema = (taskType: 'task1' | 'task2') => {
  const TRSubItems = taskType === 'task1' ? Task1TRSubItems : Task2TRSubItems;

  return z.object({
    topic: z.string().describe('The topic or question text identified'),
    dimensions: z.object({
      taskResponse: createDimensionSchema(TRSubItems),
      coherenceCohesion: createDimensionSchema(CCSubItems),
      lexicalResource: createDimensionSchema(LRSubItems),
      grammaticalRangeAccuracy: createDimensionSchema(GRASubItems)
    }),
    overallScore: z.number().describe('Overall Band Score (0-9)'),
    paragraphRewrites: z.array(ParagraphRewriteSchema),
    correctedSentences: z.array(CorrectedSentenceSchema),
    toolkit: ToolkitSchema,
    referenceEssay: z.string().describe('A high-quality sample essay for this topic'),
    estimatedWordBand: z.number().describe('Estimated band score based on vocabulary and grammar richness').optional()
  });
};

export type EvaluationSchemaType = z.infer<ReturnType<typeof getEvaluationSchema>>;

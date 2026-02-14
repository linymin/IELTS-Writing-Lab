import { z } from 'zod';

const SubItemSchema = z.object({
  score: z.number().describe('Score for this sub-dimension (0-9)'),
  reason: z.string().describe('Detailed explanation for the score in the requested language')
});

const DimensionBaseSchema = z.object({
  score: z.number().describe('Band score for this dimension (0-9)'),
  reason: z.string().describe('General feedback for this dimension in the requested language')
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
  essayOutline: z.string().describe('Essay outline in the requested language'),
  vocabulary: z.array(z.object({
    word: z.string(),
    definition: z.string().describe('Definition in the requested language'),
    context: z.string().describe('Example usage context')
  })),
  grammar: z.array(z.object({
    type: z.string(),
    example: z.string(),
    explanation: z.string().describe('Grammar explanation in the requested language')
  })),
  cohesion: z.array(z.object({
    type: z.string(),
    suggestion: z.string().describe('Suggestion in the requested language'),
    example: z.string()
  }))
});

export const ParagraphRewriteSchema = z.object({
  paragraphType: z.enum(['Introduction', 'Body Paragraph', 'Conclusion']).or(z.string()),
  originalText: z.string().optional(),
  critique: z.string().describe('Critique of the paragraph in the requested language'),
  rewrite: z.string().describe('Improved version of the paragraph')
});

export const CorrectedSentenceSchema = z.object({
  original: z.string(),
  correction: z.string(),
  explanation: z.string().describe('Explanation of the error in the requested language')
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
    referenceEssay: z.string().describe('A high-quality sample essay for this topic in the requested language'),
    estimatedWordBand: z.number().describe('Estimated band score based on vocabulary and grammar richness').optional()
  });
};

export type EvaluationSchemaType = z.infer<ReturnType<typeof getEvaluationSchema>>;

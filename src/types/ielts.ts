export interface BandScore {
  band: number;
  reason: string;
  sub_scores: Record<string, number>;
}

export interface CorrectedSentence {
  original: string;
  correction: string;
  explanation: string;
}

export interface EvaluationResponse {
  overall_band: number;
  TR: BandScore;
  CC: BandScore;
  LR: BandScore;
  GRA: BandScore;
  corrected_sentences: CorrectedSentence[];
  estimated_word_band?: number;
}

export interface ScoreRequest {
  essay_body: string;
  task_type: 'task1' | 'task2';
  question_text: string;
  question_id?: string;
  user_history?: {
    essay_id: string;
    overall_band: number;
    feedback_summary: string;
  }[];
}

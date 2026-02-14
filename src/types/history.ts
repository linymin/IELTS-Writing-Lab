export interface EssayRecord {
  id: string; // evaluation id
  essay_id: string;
  topic: string;
  overall_score: number;
  dimensions: {
    TR: number;
    CC: number;
    LR: number;
    GRA: number;
  };
  created_at: string;
  task_type: 'task1' | 'task2';
}

export interface EssayGroup {
  topic: string;
  latest: EssayRecord;
  history: EssayRecord[];
}

export type TaskType = 1 | 2;

export interface Question {
  id: string;
  book_no: number;
  test_no: number;
  task_type: TaskType;
  question_type: string; // e.g., 'Map', 'Bar Chart', 'Opinion', 'Discussion'
  topic: string; // e.g., 'Environment', 'Education'
  content: string;
  image_url?: string;
  model_answer?: string;
  tags?: string[];
}

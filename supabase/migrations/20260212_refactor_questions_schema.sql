-- Migration: Refactor questions table for custom topics support
-- Date: 2026-02-12

-- 1. Modify columns to allow nulls for official identifiers and add user_id
ALTER TABLE public.questions 
  ALTER COLUMN book_no DROP NOT NULL,
  ALTER COLUMN test_no DROP NOT NULL,
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (which required book_no/test_no to be unique)
ALTER TABLE public.questions 
  DROP CONSTRAINT IF EXISTS questions_book_test_task_unique;

-- 3. Add new unique index for OFFICIAL questions (where user_id is null)
-- This ensures we don't have duplicate official questions
CREATE UNIQUE INDEX idx_questions_official_unique 
  ON public.questions (book_no, test_no, task_type) 
  WHERE user_id IS NULL;

-- 4. Add new unique index for CUSTOM questions (where user_id is NOT null)
-- This prevents a user from creating duplicate custom questions with exact same content
CREATE UNIQUE INDEX idx_questions_custom_unique 
  ON public.questions (user_id, content) 
  WHERE user_id IS NOT NULL;

-- 5. Update RLS Policies

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow public read access" ON public.questions;
DROP POLICY IF EXISTS "Users can create own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can update own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can delete own questions" ON public.questions;

-- Policy: Select
-- Allow users to see:
-- 1. Official questions (user_id IS NULL)
-- 2. Their own custom questions (user_id = auth.uid())
CREATE POLICY "Allow read access to official and own questions" 
  ON public.questions FOR SELECT 
  USING (
    user_id IS NULL OR 
    user_id = auth.uid()
  );

-- Policy: Insert
-- Allow users to insert their own questions
CREATE POLICY "Users can create own questions" 
  ON public.questions FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy: Update
-- Allow users to update their own questions
CREATE POLICY "Users can update own questions" 
  ON public.questions FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy: Delete
-- Allow users to delete their own questions
CREATE POLICY "Users can delete own questions" 
  ON public.questions FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Data Migration (Backfill)
-- Create questions for existing essays that have no question_id
INSERT INTO public.questions (
  user_id, 
  content, 
  topic, 
  question_type, 
  task_type,
  created_at
)
SELECT DISTINCT ON (user_id, question_text)
  user_id,
  question_text as content,
  'Custom Topic' as topic,
  'Custom' as question_type,
  CASE WHEN task_type = 'task1' THEN 1 ELSE 2 END as task_type,
  submitted_at as created_at
FROM public.essays
WHERE question_id IS NULL AND question_text IS NOT NULL
ON CONFLICT (user_id, content) WHERE user_id IS NOT NULL DO NOTHING;

-- Update essays to point to the new questions
UPDATE public.essays e
SET question_id = q.id
FROM public.questions q
WHERE e.question_id IS NULL
  AND e.question_text = q.content
  AND e.user_id = q.user_id;

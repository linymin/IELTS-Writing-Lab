
-- Add question_id column to essays table
alter table public.essays
add column question_id uuid references public.questions(id);

-- Create index for faster lookups
create index idx_essays_question_id on public.essays(question_id);

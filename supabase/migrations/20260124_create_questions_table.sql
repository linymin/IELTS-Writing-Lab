-- Create questions table with enhanced schema
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  book_no integer not null,
  test_no integer not null,
  task_type integer not null check (task_type in (1, 2)), -- 1=Task 1, 2=Task 2
  question_type text, -- e.g., "Bar Chart", "Opinion Essay"
  topic text, -- e.g., "Environment", "Education"
  content text not null,
  image_url text,
  model_answer text,
  tags text[], -- Array of tags e.g. ['hard', 'prediction']
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add unique constraint to prevent duplicates
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_book_test_task_unique'
  ) then
    alter table public.questions
    add constraint questions_book_test_task_unique unique (book_no, test_no, task_type);
  end if;
end $$;

-- Create indexes for common filters
create index if not exists idx_questions_task_type on public.questions (task_type);
create index if not exists idx_questions_topic on public.questions (topic);
create index if not exists idx_questions_book_no on public.questions (book_no);

-- Enable Row Level Security
alter table public.questions enable row level security;

-- Policies
-- 1. Allow public read access (everyone can see questions)
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Allow public read access' and tablename = 'questions'
  ) then
    create policy "Allow public read access" on public.questions for select using (true);
  end if;
end $$;

-- 2. Allow service role full access (for seeding/admin)
-- (Implicit in Supabase service_role, but explicit policy can be added if using other roles)

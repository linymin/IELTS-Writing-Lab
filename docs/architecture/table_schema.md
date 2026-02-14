#### attempts表
```
create table public.attempts (
  id uuid not null default extensions.uuid_generate_v4 (),
  essay_id uuid not null,
  evaluation_id uuid not null,
  attempt_no integer not null default 1,
  delta_band jsonb null,
  trend_comment text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint attempts_pkey primary key (id),
  constraint attempts_essay_id_fkey foreign KEY (essay_id) references essays (id) on delete CASCADE,
  constraint attempts_evaluation_id_fkey foreign KEY (evaluation_id) references evaluations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_attempts_essay_attempt on public.attempts using btree (essay_id, attempt_no) TABLESPACE pg_default;
```


#### essays
```
create table public.essays (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  task_type text not null,
  question_text text not null,
  essay_body text not null,
  word_count integer not null,
  submitted_at timestamp with time zone not null default timezone ('utc'::text, now()),
  question_id uuid null,
  constraint essays_pkey primary key (id),
  constraint essays_question_id_fkey foreign KEY (question_id) references questions (id) on delete set null,
  constraint essays_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint essays_task_type_check check (
    (
      task_type = any (array['task1'::text, 'task2'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_essays_user_submitted on public.essays using btree (user_id, submitted_at desc) TABLESPACE pg_default;

create index IF not exists idx_essays_question_id on public.essays using btree (question_id) TABLESPACE pg_default;
```


#### evaluations
```
create table public.evaluations (
  id uuid not null default extensions.uuid_generate_v4 (),
  essay_id uuid not null,
  band_scores jsonb null,
  overall_band numeric(3, 1) null,
  detailed_feedback jsonb null,
  rubric_mapping jsonb not null default '{"version": "v1"}'::jsonb,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  status text not null default 'completed'::text,
  constraint evaluations_pkey primary key (id),
  constraint evaluations_essay_id_fkey foreign KEY (essay_id) references essays (id) on delete CASCADE,
  constraint status_check check (
    (
      status = any (
        array[
          'processing'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_evaluations_essay_id on public.evaluations using btree (essay_id) TABLESPACE pg_default;
```


#### questions
```
create table public.questions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone null default now(),
  book_no integer not null,
  test_no integer not null,
  task_type integer not null,
  question_type text null,
  topic text null,
  content text not null,
  image_url text null,
  constraint questions_pkey primary key (id),
  constraint unique_exam_question unique (book_no, test_no, task_type)
) TABLESPACE pg_default;
```

#### users
```
create table public.users (
  id uuid not null,
  email text not null,
  plan text null default 'free'::text,
  subscription_status text null default 'none'::text,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint users_pkey primary key (id),
  constraint users_id_fkey foreign KEY (id) references auth.users (id),
  constraint users_plan_check check (
    (
      plan = any (
        array['free'::text, 'pro'::text, 'enterprise'::text]
      )
    )
  ),
  constraint users_subscription_status_check check (
    (
      subscription_status = any (
        array[
          'active'::text,
          'past_due'::text,
          'canceled'::text,
          'none'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;
```
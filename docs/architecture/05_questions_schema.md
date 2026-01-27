---
title: Questions Table Schema Design
version: 1.0
date: 2026-01-24
author: 雅思架构师
---

# Questions Table Schema Design

## 1. 核心目标
存储剑桥雅思真题库（Cambridge IELTS 5-20）及预测题库。支持按题型、话题、书号进行检索，并为前端提供题目内容和范文参考。

## 2. 数据库设计 (Supabase/PostgreSQL)

### Table: `questions`

| Column Name | Type | Constraint | Description |
|---|---|---|---|
| `id` | `uuid` | `PK`, `default gen_random_uuid()` | 题目唯一标识 |
| `book_no` | `integer` | `NOT NULL` | 剑桥书号 (e.g., 19) |
| `test_no` | `integer` | `NOT NULL` | Test 序号 (1-4) |
| `task_type` | `integer` | `NOT NULL`, `CHECK (in (1, 2))` | 1=Task 1, 2=Task 2 |
| `question_type` | `text` | | 题型 (e.g., "Bar Chart", "Opinion") |
| `topic` | `text` | | 话题 (e.g., "Education") |
| `content` | `text` | `NOT NULL` | 题目完整文本 |
| `image_url` | `text` | | Task 1 的图表图片地址 |
| `model_answer` | `text` | | 官方或高分范文 |
| `tags` | `text[]` | | 额外标签 (e.g., ["2024预测", "高频"]) |
| `created_at` | `timestamptz` | `default now()` | 创建时间 |
| `updated_at` | `timestamptz` | `default now()` | 更新时间 |

### Constraints & Indexes
1.  **Unique Constraint**: `(book_no, test_no, task_type)` 确保同一本书同一个 Test 的同一 Task 只有一条记录。
2.  **Indexes**:
    - `idx_questions_task_type`: 加速按 Task 1/2 筛选。
    - `idx_questions_topic`: 加速按话题筛选。
    - `idx_questions_book_no`: 加速按书号筛选。

### RLS Policies
-   **Select**: `public` (authenticated & anon) can read.
-   **Insert/Update/Delete**: Only `service_role` or admin users (if admin system exists).

## 3. SQL Definition

```sql
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  book_no integer not null,
  test_no integer not null,
  task_type integer not null check (task_type in (1, 2)),
  question_type text,
  topic text,
  content text not null,
  image_url text,
  model_answer text,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint questions_book_test_task_unique unique (book_no, test_no, task_type)
);

-- Indexes for performance
create index if not exists idx_questions_task_type on public.questions (task_type);
create index if not exists idx_questions_topic on public.questions (topic);
create index if not exists idx_questions_book_no on public.questions (book_no);

-- RLS
alter table public.questions enable row level security;

create policy "Allow public read access" 
  on public.questions for select 
  using (true);
```

## 4. Summary
- **Total Tables**: 1 (`questions`)
- **Total Indexes**: 3 custom indexes + 1 PK + 1 Unique
- **Expected Growth**: Low (Static dataset, ~4 tests * 2 tasks * 15 books ≈ 120 rows + predictions).

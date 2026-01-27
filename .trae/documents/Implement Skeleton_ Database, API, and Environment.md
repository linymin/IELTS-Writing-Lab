# Implement Skeleton: Database, API, and Environment

Since the current directory only contains documentation, I will start by initializing the project structure and then implement the requested components.

## 1. Project Initialization

* **Action**: Initialize a new Next.js project (App Router, TypeScript) in the current directory.

* **Reason**: To provide a valid runtime environment and TypeScript configuration for the requested code.

## 2. Database Migration (Supabase)

* **File**: `supabase/migrations/20260123_initial_schema.sql`

* **Content**: Copy the schema from `docs/architecture/02_database_schema.sql`.

* **Details**: This file will serve as the source of truth for the database structure. The RLS policies are already embedded in the SQL, ensuring security by default (Users can only access their own data).

## 3. Type Definitions

* **File**: `src/types/ielts.ts`

* **Content**: Define TypeScript interfaces matching the JSON Schema in `03_llm_api_protocol.md` (e.g., `EvaluationResponse`, `BandScore`, `ScoreRequest`).

* **Goal**: Ensure type safety and protocol compliance.

## 4. Backend Route Skeleton (Mock)

* **File**: `src/app/api/evaluate/route.ts`

* **Logic**:

  * **POST Handler**: Accepts `essay_body`, `task_type`, `question_text`.

  * **Validation**: Checks for missing fields (returns 400).

  * **Mock Response**: Returns a static JSON object adhering to the `EvaluationResponse` interface, covering all 4 dimensions (TR, CC, LR, GRA).

  * **Error Handling**: Basic try-catch block.

## 5. Environment Configuration

* **File**: `.env.example`

* **Content**:

  * `NEXT_PUBLIC_SUPABASE_URL`

  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`

  * `OPENAI_API_KEY` (for future LLM integration)


I will unify the evaluation submission and result retrieval logic across all three pages (Workshop, Question, Rewrite) to ensure consistency and reliability on the server.

The core issue is that the **Rewrite** page uses a manual `fetch` + polling approach that is prone to race conditions and timeouts on serverless environments (Vercel), while the **Workshop** page uses the robust `useObject` hook. The **Question** page (which redirects to Workshop) likely suffers from similar state/polling inconsistencies or specific data payload issues.

My plan is to standardise everything to use `useObject` and a shared polling hook.

### 1. Create Shared Polling Hook (`src/hooks/useEvaluationPoller.ts`)
Create a custom hook `useEvaluationPoller` to centralize the logic for retrieving the newly created evaluation ID from Supabase.
- **Functionality**: Polls the `essays` table for the latest submission by the current user.
- **Retry Logic**: Implements exponential backoff or fixed interval retries (e.g., up to 15 seconds) to handle the background processing delay on the server.
- **Consistency**: Ensures both Workshop and Rewrite pages use the exact same criteria to find the result.

### 2. Refactor Rewrite Page (`src/app/evaluation/processing/page.tsx`)
Completely rewrite the `ProcessingContent` component to match the `Workshop` implementation:
- **Remove**: Manual `fetch` and `getReader()` stream parsing.
- **Add**: `experimental_useObject` from `@ai-sdk/react`.
- **Logic**: 
    - On mount, read the payload from `sessionStorage`.
    - Trigger `submit()` via `useObject` immediately.
    - Use the `onFinish` callback to trigger the new `useEvaluationPoller` logic.
    - This keeps the connection alive, preventing serverless timeouts and "No evaluation ID" errors.

### 3. Update Workshop Page (`src/app/workshop/page.tsx`)
Refactor to use the new `useEvaluationPoller` hook:
- **Replace**: The inline `checkSaved` function with the shared hook.
- **Validation**: Add a check before submission to ensure `topic` (question text) is not empty, preventing potential invalid requests that might cause `ERR_EMPTY_RESPONSE` or 400 errors when coming from the Question page.

### 4. Verification
- **Workshop**: Verify standard submission still works.
- **Question Flow**: Verify submitting a question (via Workshop with `question_id`) works.
- **Rewrite**: Verify the "Processing" page correctly triggers the API and redirects to the new evaluation.

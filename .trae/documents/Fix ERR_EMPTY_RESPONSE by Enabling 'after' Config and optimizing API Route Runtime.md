Based on the error log `net::ERR_EMPTY_RESPONSE` and the current codebase analysis, the issue is likely caused by improper handling of streaming responses and the experimental `after` API in Next.js. The server process might be crashing or closing the connection prematurely because the `after` hook is being called inside the stream's `onFinish` callback (which is too late in the lifecycle) rather than at the top level of the request handler. Additionally, the `experimental.after` flag is missing in `next.config.ts`.

My plan is to fix the server-side API implementation to ensure robust streaming and background processing.

### 1. Enable `after` in `next.config.ts`
The `after` API is experimental in Next.js 15 (and likely 16+ which you are using). It must be explicitly enabled to function correctly without causing runtime errors.
-   **Action**: Update `next.config.ts` to include `experimental: { after: true }`.

### 2. Refactor `src/app/api/evaluate/route.ts`
The current implementation calls `after` inside `onFinish`, which is an anti-pattern that can lead to race conditions where the response stream closes before the background task is registered.
-   **Switch to Edge Runtime**: Add `export const runtime = 'edge';` to prevent Node.js buffering issues that often cause empty responses with streaming.
-   **Fix `after` Usage**: Move `after` to the top level of the `POST` function. Instead of triggering it in `onFinish`, register it immediately to await the `result.object` promise. This ensures the background task is correctly bound to the request lifecycle.
-   **Error Handling**: Wrap the stream initialization in a try-catch block to return a proper 500 JSON response if the AI provider fails immediately, rather than crashing the connection.

### 3. Verification
-   **Server Config**: Verify `next.config.ts` has the new flag.
-   **API Route**: Verify the `POST` handler correctly awaits the stream object in the background without blocking the main response stream.
-   **End-to-End**: The user should be able to submit from the Question/Workshop page and receive a streaming response immediately, with the database save happening reliably in the background.

Based on the build error log and the analysis of the Next.js `after` API compatibility, the issue is indeed related to the use of `experimental: { after: true }` in conjunction with `runtime = 'edge'`.

The `after` API in Next.js relies on the Node.js runtime to schedule tasks after the response has been sent. It is **not compatible with the Edge Runtime** because the Edge environment (like Cloudflare Workers or Vercel Edge Functions) typically kills the execution context immediately after the response is returned, unless specific platform features (like `waitUntil`) are used, which `next/after` abstracts but requires specific platform support.

The build failure `exit code: 1` during `npm run build` likely stems from a type check or a static analysis step in Next.js that detects this incompatibility (using `after` in a route exported with `runtime = 'edge'`).

### Solution Plan

1.  **Switch Runtime to `nodejs`**: Change `runtime = 'edge'` back to `runtime = 'nodejs'` in `src/app/api/evaluate/route.ts`. The `after` API is designed to work seamlessly in the Node.js runtime (including Serverless Functions), where it can keep the Lambda warm until the background task completes.
2.  **Keep `after` Config**: Keep `experimental: { after: true }` in `next.config.ts` as it is required for the feature to work in the Node.js runtime.
3.  **Address Buffering**: The reason we switched to `edge` was to fix `ERR_EMPTY_RESPONSE` (buffering). In Node.js runtime, we can still achieve streaming without buffering by returning a direct `Response` or `NextResponse` with an iterator/stream, which `streamObject().toTextStreamResponse()` already handles. The `ERR_EMPTY_RESPONSE` was likely caused by the crash (due to improper `after` usage inside `onFinish`) rather than just buffering. Now that `after` is correctly placed at the top level, the Node.js runtime should handle the stream correctly without crashing.

This change ensures build compatibility on Tencent Cloud (which uses standard Node.js containers) while maintaining the background processing capability.

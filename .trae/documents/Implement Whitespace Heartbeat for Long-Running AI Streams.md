I will fix the `ECONNRESET` / `Idle Timeout` issue caused by the "silent" initial thinking phase of the Doubao model.

**Diagnosis:**
The Doubao model takes 40-60s to "think" before generating the first token. During this time, the `/api/evaluate` stream is silent (sends 0 bytes). The Tencent Cloud Gateway detects this silence and kills the connection after 60s (Idle Timeout), causing `ECONNRESET` on the server and `ERR_EMPTY_RESPONSE` on the client.

**Solution:**
I will implement a **"Whitespace Heartbeat" mechanism** in the API route.
1.  **Immediate Keep-Alive:** As soon as the request is received and validation passes, I will modify the response stream to send an initial whitespace character (` `). This establishes the connection and prevents immediate "empty response" errors.
2.  **Periodic Heartbeat:** I will inject a whitespace character every 15 seconds into the stream *while waiting* for the first token from the AI.
3.  **Seamless Handoff:** Once the AI starts generating real JSON data, the heartbeat stops, and the actual response is piped through.
    *   *Note:* Leading whitespace is valid in JSON streams and is ignored by the client-side parser, so this is safe.

**Implementation Plan:**
1.  Modify `src/app/api/evaluate/route.ts`.
2.  Wrap the `result.toTextStreamResponse()` body in a custom `ReadableStream`.
3.  Add logic to enqueue whitespace bytes (`0x20`) periodically until the first chunk of the AI stream arrives.
4.  Ensure all CORS headers are preserved.

This ensures the connection stays "active" from the gateway's perspective, even if the AI takes minutes to reply.
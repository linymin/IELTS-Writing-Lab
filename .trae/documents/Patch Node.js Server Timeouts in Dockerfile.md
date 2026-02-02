I will fix the 60s timeout and `ECONNRESET` crash by patching the internal Node.js server configuration within the Docker container.

**Diagnosis:**
The 60-second cutoff is a known issue in containerized Next.js applications (especially `standalone` mode). It occurs because of a mismatch between the Node.js default timeouts and the infrastructure (Load Balancers, Docker networking, or Cloud Firewalls) which often default to 60s. When the timeouts align or conflict, the connection is forcibly reset, causing the `Error: aborted` crash you see in the logs.

**Plan:**
1.  **Modify `Dockerfile`**: Add a `RUN sed` command to patch the generated `server.js` file.
    *   We will explicitly set `server.keepAliveTimeout` and `server.headersTimeout` to 120 seconds (2 minutes).
    *   This ensures the Node.js server keeps connections open longer than the infrastructure's 60s limit, preventing the race condition that causes the reset.
2.  **Redeploy**: You will need to rebuild the Docker image for this patch to take effect.

This `sed` patch is the standard industry fix for "Next.js Docker 60s timeout" issues.
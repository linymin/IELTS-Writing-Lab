Based on the build error log, the root cause is a peer dependency conflict: `@ai-sdk/react@3.0.59` expects `react@"^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"`, but the project is configured with `react@"19.0.0"`.

To resolve this and ensure a successful build on the server (which likely runs strictly without user intervention flags like `--force` unless configured), the most robust solution is to align the dependencies.

### Plan

1.  **Update `package.json`**:
    *   **Option A (Preferred for compatibility)**: Upgrade `@ai-sdk/react` and related packages to `latest` to see if they support React 19.0.0 officially. However, if the latest version still has strict peer deps, we might need to adjust React.
    *   **Option B (Align React)**: Change `react` and `react-dom` versions in `package.json` to `19.0.0` (which we already did) but the error persists because the *SDK* demands specific patches like `~19.0.1`. The error message says: `peer react@"^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"`. Notice it *excludes* `19.0.0` specifically (it wants 19.0.1+).
    *   **Action**: I will update `react` and `react-dom` to **`19.0.0-rc.1`** or simply **`19.0.0`** but force the resolution using `overrides` or by bumping React to a version that satisfies the peer dep if possible.
    *   **Better Action**: Since the error says `Found: react@19.0.0`, and the requirement is `~19.0.1`, I should just bump `react` and `react-dom` to **`19.0.0`** is actually *older* or *different* than `~19.0.1`. Wait, `~19.0.1` means `>=19.0.1 <19.1.0`. So `19.0.0` is indeed incompatible.
    *   **Correct Fix**: Update `react` and `react-dom` to **`^19.0.0`** or specifically **`19.0.0`** is failing. Let's try bumping them to **`19.0.0`** -> **`19.0.0`** was what caused it. Actually, looking closely at the error: `peer react@"^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"`. This is a very specific list. It seems `@ai-sdk/react` is very picky.
    *   **Strategy**: I will use `overrides` in `package.json` to force the dependency resolution. This is the standard way to handle peer dependency conflicts in npm 8+ without using CLI flags like `--legacy-peer-deps` which might not be easy to inject in a PaaS build command.

2.  **Implementation**:
    *   Add an `overrides` section to `package.json`.
    *   Force `@ai-sdk/react` to accept the installed React version, OR force the project to use a React version that satisfies the SDK.
    *   Given we want to use Next.js 15 (which uses React 19), I will add `overrides` to ensure `react` and `react-dom` resolve to the version specified in `dependencies`.

### Tasks
1.  Modify `package.json` to add `"overrides": { "react": "$react", "react-dom": "$react-dom" }`. This tells npm "whatever version of react I have installed, force all other packages to use that one", effectively silencing the peer dependency conflict.
2.  Also, I will bump `react` and `react-dom` to `19.0.0` (keeping them pinned is good, but `overrides` will make it work).

This is safer than guessing which specific patch version of React 19 the SDK wants today.

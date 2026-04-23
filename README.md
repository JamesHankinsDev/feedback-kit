# @jbdevelopment/feedback-kit

A drop-in feedback + bug reporting widget for React / Next.js apps. Ideas post to Canny, bugs file as Linear issues.

- Floating pill component (`FeedbackButton`) with an Idea/Bug toggle
- Next.js App Router route handler that validates, rate-limits, and dispatches to Canny or Linear
- Framework-agnostic core (`submitFeedback`, `checkRateLimit`) for non-Next consumers
- Dual ESM + CJS output with `.d.ts` / `.d.cts` types
- Tailwind-styled (consumers are expected to have Tailwind)

## Install

```bash
npm install @jbdevelopment/feedback-kit
```

Peer deps: `react >=18`, `next >=13` (Next is optional — only needed if you use the route handler).

## Client usage

```tsx
// app/layout.tsx
import { FeedbackButton } from "@jbdevelopment/feedback-kit/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <FeedbackButton
          appSlug="my-app"
          user={{ id: "u_123", email: "me@example.com", name: "Me" }}
        />
      </body>
    </html>
  );
}
```

### Props

| Prop        | Type                                      | Default           | Notes                                                        |
| ----------- | ----------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `appSlug`   | `string`                                  | —                 | **Required.** Prefixes submissions (e.g. `[my-app] Title`). |
| `endpoint`  | `string`                                  | `/api/feedback`   | Where submissions are POSTed.                                |
| `user`      | `{ id?; email?; name? }`                  | `undefined`       | Identifies the submitter. Missing = anonymous.               |
| `position`  | `"bottom-right" \| "bottom-left"`         | `"bottom-right"`  | Anchor for the floating pill.                                |
| `inline`    | `boolean`                                 | `false`           | Render as an inline button instead of a FAB.                 |
| `className` | `string`                                  | `undefined`       | Extra classes for the trigger.                               |

The component:

- Adds `"use client";` at the top of the built file so it works in the App Router
- Autofocuses the title, supports Esc-to-close, validates title (3–200 chars) and details (<5000 chars)
- Captures page URL, path, user agent, viewport, and timestamp on submit
- Auto-reports widget failures: if a submission hits a 5xx or network error, the widget files a single Linear bug describing the failure (once per session)

## Server usage (Next.js App Router)

The simplest integration — re-export the handler:

```ts
// app/api/feedback/route.ts
export { POST } from "@jbdevelopment/feedback-kit/server";
```

Set these env vars (per app):

| Var                    | Required | Purpose                                              |
| ---------------------- | -------- | ---------------------------------------------------- |
| `CANNY_API_KEY`        | ideas    | Canny API key.                                       |
| `CANNY_BOARD_ID`       | ideas    | Canny board that receives ideas.                     |
| `CANNY_CATEGORY_ID`    | no       | Optional — category to assign to new posts.          |
| `LINEAR_API_KEY`       | bugs     | Linear API key (personal or OAuth).                  |
| `LINEAR_TEAM_ID`       | bugs     | Linear team that owns the bug issues.                |
| `LINEAR_PROJECT_ID`    | no       | Optional — attach bugs to a project.                 |
| `LINEAR_BUG_LABEL_ID`  | no       | Optional — label applied to every filed bug.         |

### Explicit config

If you'd rather inject config than read `process.env`:

```ts
// app/api/feedback/route.ts
import { createPOST } from "@jbdevelopment/feedback-kit/server";

export const POST = createPOST({
  cannyApiKey: process.env.CANNY_KEY,
  cannyBoardId: process.env.CANNY_BOARD,
  cannyCategoryId: process.env.CANNY_CATEGORY,
  linearApiKey: process.env.LINEAR_KEY,
  linearTeamId: process.env.LINEAR_TEAM,
  linearProjectId: process.env.LINEAR_PROJECT,
  linearBugLabelId: process.env.LINEAR_BUG_LABEL,
});
```

## Framework-agnostic usage

The package exports a core function that works anywhere:

```ts
import {
  submitFeedback,
  checkRateLimit,
  validateFeedbackPayload,
} from "@jbdevelopment/feedback-kit/server";

// In your own handler:
const rl = checkRateLimit(clientIp);
if (!rl.allowed) return { status: 429 };

const v = validateFeedbackPayload(await req.json());
if (!v.ok) return { status: 400, error: v.error };

const result = await submitFeedback(v.payload, {
  cannyApiKey: process.env.CANNY_API_KEY,
  cannyBoardId: process.env.CANNY_BOARD_ID,
  linearApiKey: process.env.LINEAR_API_KEY,
  linearTeamId: process.env.LINEAR_TEAM_ID,
});
```

## Rate limiting

In-memory, 5 requests per 10 minutes per IP. Replaced with nothing — fine for low-traffic personal apps. If you need distributed or persistent rate limiting, call `submitFeedback` from your own handler and skip `checkRateLimit`.

## Response shape

```ts
// Success
{ "ok": true, "kind": "idea" | "bug", "id": "...", "url"?: "..." }

// Error
{ "ok": false, "error": "human-readable message" }
```

- `400` — payload validation failed
- `429` — rate limited (includes `Retry-After` header)
- `500` — upstream not configured (missing env vars)
- `502` — Canny or Linear returned an error

## License

MIT © James Hankins

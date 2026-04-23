import {
  checkRateLimit,
  submitFeedback,
  validateFeedbackPayload,
  type FeedbackConfig,
} from "./handler";

export type { FeedbackConfig } from "./handler";

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });
}

function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0];
    if (first) return first.trim();
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Create a POST handler bound to an explicit config. Use this when you
 * want to inject credentials rather than read from process.env.
 */
export function createPOST(config: FeedbackConfig) {
  return async function POST(req: Request): Promise<Response> {
    const ip = extractIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return jsonResponse(
        { ok: false, error: "Too many requests. Please try again later." },
        429,
        { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const validation = validateFeedbackPayload(body);
    if (!validation.ok) {
      return jsonResponse({ ok: false, error: validation.error }, 400);
    }

    const result = await submitFeedback(validation.payload, config);
    return jsonResponse(result.body, result.status);
  };
}

function envConfig(): FeedbackConfig {
  return {
    cannyApiKey: process.env.CANNY_API_KEY,
    cannyBoardId: process.env.CANNY_BOARD_ID,
    cannyCategoryId: process.env.CANNY_CATEGORY_ID,
    linearApiKey: process.env.LINEAR_API_KEY,
    linearTeamId: process.env.LINEAR_TEAM_ID,
    linearProjectId: process.env.LINEAR_PROJECT_ID,
    linearBugLabelId: process.env.LINEAR_BUG_LABEL_ID,
  };
}

/**
 * Default POST handler that reads configuration from process.env.
 * Re-export from your app: `export { POST } from "@jbdevelopment/feedback-kit/server";`
 */
export async function POST(req: Request): Promise<Response> {
  return createPOST(envConfig())(req);
}

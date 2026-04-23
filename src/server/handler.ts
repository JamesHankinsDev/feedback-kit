export type FeedbackKind = "idea" | "bug";

export type FeedbackPayloadUser = {
  id?: string;
  email?: string;
  name?: string;
};

export type FeedbackContext = {
  url?: string;
  path?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  timestamp?: string;
};

export type FeedbackPayload = {
  kind: FeedbackKind;
  title: string;
  details?: string;
  appSlug: string;
  user?: FeedbackPayloadUser;
  context?: FeedbackContext;
  meta?: Record<string, unknown>;
};

export type FeedbackConfig = {
  cannyApiKey?: string;
  cannyBoardId?: string;
  cannyCategoryId?: string;
  linearApiKey?: string;
  linearTeamId?: string;
  linearProjectId?: string;
  linearBugLabelId?: string;
};

export type FeedbackSuccess = {
  ok: true;
  kind: FeedbackKind;
  id: string;
  url?: string;
};

export type FeedbackError = {
  ok: false;
  error: string;
};

export type FeedbackResult = {
  status: number;
  body: FeedbackSuccess | FeedbackError;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const TITLE_MIN = 3;
const TITLE_MAX = 200;
const DETAILS_MAX = 5000;
const APP_SLUG_MAX = 64;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const previous = rateLimitMap.get(ip) ?? [];
  const recent = previous.filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = recent[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    rateLimitMap.set(ip, recent);
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return { allowed: true };
}

export function validateFeedbackPayload(
  input: unknown,
):
  | { ok: true; payload: FeedbackPayload }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = input as Record<string, unknown>;

  if (p.kind !== "idea" && p.kind !== "bug") {
    return { ok: false, error: "kind must be 'idea' or 'bug'" };
  }

  if (typeof p.title !== "string") {
    return { ok: false, error: "title is required" };
  }
  const title = p.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `title must be ${TITLE_MIN}–${TITLE_MAX} characters`,
    };
  }

  let details: string | undefined;
  if (p.details !== undefined && p.details !== null) {
    if (typeof p.details !== "string") {
      return { ok: false, error: "details must be a string" };
    }
    if (p.details.length > DETAILS_MAX) {
      return {
        ok: false,
        error: `details must be under ${DETAILS_MAX} characters`,
      };
    }
    details = p.details;
  }

  if (typeof p.appSlug !== "string" || p.appSlug.length === 0) {
    return { ok: false, error: "appSlug is required" };
  }
  if (p.appSlug.length > APP_SLUG_MAX) {
    return { ok: false, error: "appSlug is too long" };
  }

  const user = isPlainObject(p.user)
    ? pickUser(p.user as Record<string, unknown>)
    : undefined;
  const context = isPlainObject(p.context)
    ? pickContext(p.context as Record<string, unknown>)
    : undefined;
  const meta = isPlainObject(p.meta)
    ? (p.meta as Record<string, unknown>)
    : undefined;

  return {
    ok: true,
    payload: {
      kind: p.kind,
      title,
      details,
      appSlug: p.appSlug,
      user,
      context,
      meta,
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickUser(u: Record<string, unknown>): FeedbackPayloadUser {
  const out: FeedbackPayloadUser = {};
  if (typeof u.id === "string") out.id = u.id;
  if (typeof u.email === "string") out.email = u.email;
  if (typeof u.name === "string") out.name = u.name;
  return out;
}

function pickContext(c: Record<string, unknown>): FeedbackContext {
  const out: FeedbackContext = {};
  if (typeof c.url === "string") out.url = c.url;
  if (typeof c.path === "string") out.path = c.path;
  if (typeof c.userAgent === "string") out.userAgent = c.userAgent;
  if (typeof c.timestamp === "string") out.timestamp = c.timestamp;
  if (isPlainObject(c.viewport)) {
    const v = c.viewport as Record<string, unknown>;
    if (typeof v.width === "number" && typeof v.height === "number") {
      out.viewport = { width: v.width, height: v.height };
    }
  }
  return out;
}

export async function submitFeedback(
  payload: FeedbackPayload,
  config: FeedbackConfig,
): Promise<FeedbackResult> {
  if (payload.kind === "idea") {
    return submitIdea(payload, config);
  }
  return submitBug(payload, config);
}

async function submitIdea(
  payload: FeedbackPayload,
  config: FeedbackConfig,
): Promise<FeedbackResult> {
  if (!config.cannyApiKey || !config.cannyBoardId) {
    return {
      status: 500,
      body: {
        ok: false,
        error:
          "Canny is not configured. Set CANNY_API_KEY and CANNY_BOARD_ID.",
      },
    };
  }
  try {
    const identity = buildCannyIdentity(payload.user);
    const authorID = await cannyCreateOrUpdateUser(
      config.cannyApiKey,
      identity,
    );
    const details =
      (payload.details ?? "").trim() ||
      `Submitted from ${payload.appSlug}`;
    const postId = await cannyCreatePost(config.cannyApiKey, {
      authorID,
      boardID: config.cannyBoardId,
      title: `[${payload.appSlug}] ${payload.title}`,
      details,
      categoryID: config.cannyCategoryId,
    });
    return {
      status: 200,
      body: { ok: true, kind: "idea", id: postId },
    };
  } catch (err) {
    return {
      status: 502,
      body: { ok: false, error: errorMessage(err) },
    };
  }
}

async function submitBug(
  payload: FeedbackPayload,
  config: FeedbackConfig,
): Promise<FeedbackResult> {
  if (!config.linearApiKey || !config.linearTeamId) {
    return {
      status: 500,
      body: {
        ok: false,
        error:
          "Linear is not configured. Set LINEAR_API_KEY and LINEAR_TEAM_ID.",
      },
    };
  }
  try {
    const description = buildLinearDescription(payload);
    const labelIds = config.linearBugLabelId
      ? [config.linearBugLabelId]
      : undefined;
    const issue = await linearCreateIssue(config.linearApiKey, {
      teamId: config.linearTeamId,
      title: `[${payload.appSlug}] ${payload.title}`,
      description,
      projectId: config.linearProjectId,
      labelIds,
    });
    return {
      status: 200,
      body: { ok: true, kind: "bug", id: issue.id, url: issue.url },
    };
  } catch (err) {
    return {
      status: 502,
      body: { ok: false, error: errorMessage(err) },
    };
  }
}

type CannyIdentity = { userID: string; email: string; name: string };

const ANON_CANNY_IDENTITY: CannyIdentity = {
  userID: "feedback-kit-anon",
  email: "anon@feedback-kit.local",
  name: "Anonymous",
};

function buildCannyIdentity(user: FeedbackPayloadUser | undefined): CannyIdentity {
  if (!user || (!user.email && !user.id)) return ANON_CANNY_IDENTITY;
  const email = user.email ?? `${user.id}@feedback-kit.local`;
  const userID = user.id ?? user.email ?? ANON_CANNY_IDENTITY.userID;
  const name = user.name ?? user.email ?? "User";
  return { userID, email, name };
}

async function cannyCreateOrUpdateUser(
  apiKey: string,
  identity: CannyIdentity,
): Promise<string> {
  const res = await fetch(
    "https://canny.io/api/v1/users/create_or_update",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, ...identity }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Canny user upsert failed (${res.status}): ${snippet}`);
  }
  const data = safeJson(text) as { id?: string } | null;
  if (!data?.id) {
    throw new Error("Canny user upsert returned no id");
  }
  return data.id;
}

async function cannyCreatePost(
  apiKey: string,
  params: {
    authorID: string;
    boardID: string;
    title: string;
    details: string;
    categoryID?: string;
  },
): Promise<string> {
  const body: Record<string, unknown> = {
    apiKey,
    authorID: params.authorID,
    boardID: params.boardID,
    title: params.title,
    details: params.details,
  };
  if (params.categoryID) body.categoryID = params.categoryID;

  const res = await fetch("https://canny.io/api/v1/posts/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Canny post create failed (${res.status}): ${snippet}`);
  }
  const data = safeJson(text) as { id?: string } | null;
  if (!data?.id) {
    throw new Error("Canny post create returned no id");
  }
  return data.id;
}

async function linearCreateIssue(
  apiKey: string,
  input: {
    teamId: string;
    title: string;
    description: string;
    projectId?: string;
    labelIds?: string[];
  },
): Promise<{ id: string; identifier: string; url: string }> {
  const query = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables: { input } }),
  });
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Linear request failed (${res.status}): ${snippet}`);
  }
  const data = safeJson(text) as
    | {
        data?: {
          issueCreate?: {
            success: boolean;
            issue?: { id: string; identifier: string; url: string };
          };
        };
        errors?: { message: string }[];
      }
    | null;
  if (!data) throw new Error("Linear returned invalid JSON");
  if (data.errors?.length) {
    throw new Error(
      `Linear errors: ${data.errors.map((e) => e.message).join("; ")}`,
    );
  }
  const issue = data.data?.issueCreate?.issue;
  if (!data.data?.issueCreate?.success || !issue) {
    throw new Error("Linear issueCreate did not succeed");
  }
  return issue;
}

function buildLinearDescription(payload: FeedbackPayload): string {
  const lines: string[] = [];
  if (payload.details && payload.details.trim().length > 0) {
    lines.push("## Description");
    lines.push(payload.details.trim());
    lines.push("");
  }

  lines.push("## Submitted by");
  if (payload.user?.email || payload.user?.name || payload.user?.id) {
    lines.push(`- Name: ${payload.user.name ?? "—"}`);
    lines.push(`- Email: ${payload.user.email ?? "—"}`);
    lines.push(`- ID: ${payload.user.id ?? "—"}`);
  } else {
    lines.push("- Anonymous");
  }
  lines.push("");

  lines.push("## Context");
  lines.push(`- App: ${payload.appSlug}`);
  const ctx = payload.context;
  if (ctx?.url) lines.push(`- URL: ${ctx.url}`);
  if (ctx?.path) lines.push(`- Path: ${ctx.path}`);
  if (ctx?.userAgent) lines.push(`- User-Agent: ${ctx.userAgent}`);
  if (ctx?.viewport) {
    lines.push(`- Viewport: ${ctx.viewport.width}×${ctx.viewport.height}`);
  }
  if (ctx?.timestamp) lines.push(`- Submitted at: ${ctx.timestamp}`);

  if (payload.meta && Object.keys(payload.meta).length > 0) {
    lines.push("");
    lines.push("## Meta");
    lines.push("```json");
    lines.push(JSON.stringify(payload.meta, null, 2));
    lines.push("```");
  }

  return lines.join("\n");
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

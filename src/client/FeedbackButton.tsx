"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export type FeedbackUser = {
  id?: string;
  email?: string;
  name?: string;
};

export type FeedbackKind = "idea" | "bug";

export type FeedbackButtonProps = {
  /** Short, URL-safe identifier for the host app. Used to tag submissions (e.g. "[slug] Title"). */
  appSlug: string;
  /** API route that accepts the feedback POST. Defaults to "/api/feedback". */
  endpoint?: string;
  /** Optional identity info for the submitter. */
  user?: FeedbackUser;
  /** Where to anchor the floating pill. Ignored when `inline` is true. */
  position?: "bottom-right" | "bottom-left";
  /** Render the trigger as an inline button instead of a floating FAB. */
  inline?: boolean;
  /** Extra classes for the trigger. */
  className?: string;
};

const TITLE_MIN = 3;
const TITLE_MAX = 200;
const DETAILS_MAX = 5000;

const STYLE_ELEMENT_ID = "feedback-kit-styles";

// Styles are injected once per document, idempotently. Prefixed with `fbkit-`
// so they never collide with host app styles. Theming via CSS custom
// properties — set `--fbkit-accent` and `--fbkit-radius` on any ancestor.
const CSS = `
.fbkit-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 9999px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  color: #ffffff;
  background: var(--fbkit-accent, #171717);
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10);
  cursor: pointer;
  transition: background-color 150ms ease;
  box-sizing: border-box;
}
.fbkit-trigger:hover { background: var(--fbkit-accent-hover, #262626); }
.fbkit-trigger:focus-visible {
  outline: 2px solid rgba(23,23,23,0.4);
  outline-offset: 2px;
}
.fbkit-trigger--floating { position: fixed; z-index: 2147483646; }
.fbkit-trigger--bottom-right { bottom: 1.25rem; right: 1.25rem; }
.fbkit-trigger--bottom-left { bottom: 1.25rem; left: 1.25rem; }
.fbkit-trigger-icon { font-size: 1rem; line-height: 1; }

.fbkit-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}
.fbkit-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.fbkit-modal {
  position: relative;
  width: 100%;
  max-width: 28rem;
  padding: 1.5rem;
  background: #ffffff;
  color: #171717;
  border-radius: var(--fbkit-radius, 1rem);
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 0.875rem;
  line-height: 1.5;
  box-sizing: border-box;
}
.fbkit-modal *, .fbkit-modal *::before, .fbkit-modal *::after {
  box-sizing: border-box;
}

.fbkit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.fbkit-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #171717;
}
.fbkit-close {
  padding: 0.25rem 0.375rem;
  border: 0;
  background: transparent;
  color: #a3a3a3;
  font-size: 1rem;
  line-height: 1;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
.fbkit-close:hover { background: #f5f5f5; color: #525252; }
.fbkit-close:focus-visible {
  outline: 2px solid #a3a3a3;
  outline-offset: 1px;
}

.fbkit-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 0.25rem;
  margin-bottom: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}
.fbkit-tab {
  padding: 0.375rem 0.75rem;
  border: 0;
  background: transparent;
  color: #525252;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.fbkit-tab:hover { color: #171717; }
.fbkit-tab[aria-selected="true"] {
  background: #ffffff;
  color: #171717;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.fbkit-field { display: block; margin-bottom: 0.75rem; }
.fbkit-field--last { margin-bottom: 1rem; }
.fbkit-field-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}
.fbkit-field-label-optional {
  font-weight: 400;
  color: #a3a3a3;
}

.fbkit-input, .fbkit-textarea {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  font-family: inherit;
  color: #171717;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  box-sizing: border-box;
}
.fbkit-input:focus, .fbkit-textarea:focus {
  outline: none;
  border-color: #737373;
  box-shadow: 0 0 0 1px #737373;
}
.fbkit-input::placeholder, .fbkit-textarea::placeholder { color: #a3a3a3; }
.fbkit-textarea { resize: vertical; min-height: 5.5rem; }

.fbkit-counter {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  text-align: right;
  color: #a3a3a3;
}

.fbkit-error {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 0.875rem;
}

.fbkit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}
.fbkit-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.25;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.fbkit-btn--ghost {
  background: transparent;
  color: #525252;
}
.fbkit-btn--ghost:hover { color: #171717; }
.fbkit-btn--primary {
  background: var(--fbkit-accent, #171717);
  color: #ffffff;
}
.fbkit-btn--primary:hover { background: var(--fbkit-accent-hover, #262626); }
.fbkit-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--fbkit-accent, #171717);
}
.fbkit-btn:focus-visible {
  outline: 2px solid rgba(23,23,23,0.4);
  outline-offset: 2px;
}

.fbkit-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  text-align: center;
}
.fbkit-success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  font-size: 1.5rem;
  color: #166534;
  background: #dcfce7;
  border-radius: 9999px;
}
.fbkit-success-message { margin: 0; color: #525252; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    stylesInjected = true;
    return;
  }
  const el = document.createElement("style");
  el.id = STYLE_ELEMENT_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
  stylesInjected = true;
}

type SubmissionContext = {
  url: string;
  path: string;
  userAgent: string;
  viewport: { width: number; height: number };
  timestamp: string;
};

function captureContext(): SubmissionContext {
  return {
    url: typeof window !== "undefined" ? window.location.href : "",
    path: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    viewport: {
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
    },
    timestamp: new Date().toISOString(),
  };
}

export function FeedbackButton(props: FeedbackButtonProps) {
  const {
    appSlug,
    endpoint = "/api/feedback",
    user,
    position = "bottom-right",
    inline = false,
    className,
  } = props;

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const titleId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoReportedRef = useRef(false);

  useEffect(() => {
    injectStyles();
  }, []);

  const reset = useCallback(() => {
    setKind("idea");
    setTitle("");
    setDetails("");
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(reset, 150);
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => titleInputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
    return;
  }, [open]);

  const trimmedTitle = title.trim();
  const titleValid =
    trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX;
  const detailsValid = details.length <= DETAILS_MAX;
  const canSubmit = titleValid && detailsValid && !submitting;

  const autoReportFailure = useCallback(
    async (originalKind: FeedbackKind, message: string, status: number) => {
      if (autoReportedRef.current) return;
      autoReportedRef.current = true;
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "bug",
            title: `[feedback-kit] widget submission failed (${appSlug})`,
            details: [
              `Original submission kind: ${originalKind}`,
              `HTTP status: ${status}`,
              `Message: ${message}`,
            ].join("\n"),
            appSlug,
            user,
            context: captureContext(),
            meta: { source: "feedback-kit-auto-report" },
          }),
          keepalive: true,
        });
      } catch {
        // Swallow — the original error is already surfaced to the user.
      }
    },
    [endpoint, appSlug, user],
  );

  const submit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);

      const payload = {
        kind,
        title: trimmedTitle,
        details: details.trim() || undefined,
        appSlug,
        user,
        context: captureContext(),
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // Non-JSON response; leave body null.
        }

        if (!res.ok) {
          let message = `Request failed with status ${res.status}`;
          if (
            body &&
            typeof body === "object" &&
            "error" in body &&
            typeof (body as { error: unknown }).error === "string"
          ) {
            message = (body as { error: string }).error;
          }
          setError(message);
          setSubmitting(false);
          if (res.status >= 500) {
            void autoReportFailure(kind, message, res.status);
          }
          return;
        }

        setSuccess(true);
        setSubmitting(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Network error";
        setError(message);
        setSubmitting(false);
        void autoReportFailure(kind, message, 0);
      }
    },
    [
      canSubmit,
      kind,
      trimmedTitle,
      details,
      appSlug,
      user,
      endpoint,
      autoReportFailure,
    ],
  );

  const onBackdropKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") close();
    },
    [close],
  );

  const triggerClassList = [
    "fbkit-trigger",
    inline ? null : "fbkit-trigger--floating",
    inline
      ? null
      : position === "bottom-left"
        ? "fbkit-trigger--bottom-left"
        : "fbkit-trigger--bottom-right",
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassList}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="fbkit-trigger-icon" aria-hidden="true">💬</span>
        <span>Feedback</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onBackdropKey}
          className="fbkit-overlay"
        >
          <div
            className="fbkit-backdrop"
            onClick={close}
            aria-hidden="true"
          />
          <div className="fbkit-modal">
            {success ? (
              <div className="fbkit-success">
                <div className="fbkit-success-icon" aria-hidden="true">
                  ✓
                </div>
                <h2 id={titleId} className="fbkit-title">
                  Thanks — we got it
                </h2>
                <p className="fbkit-success-message">
                  {kind === "idea"
                    ? "Your idea has been posted for the team to review."
                    : "The bug has been logged. We'll take a look."}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="fbkit-btn fbkit-btn--primary"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="fbkit-header">
                  <h2 id={titleId} className="fbkit-title">
                    Send feedback
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    className="fbkit-close"
                    aria-label="Close"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>

                <div className="fbkit-tabs" role="tablist">
                  {(["idea", "bug"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={kind === k}
                      onClick={() => setKind(k)}
                      className="fbkit-tab"
                    >
                      {k === "idea" ? "💡 Idea" : "🐛 Bug"}
                    </button>
                  ))}
                </div>

                <label className="fbkit-field">
                  <span className="fbkit-field-label">Title</span>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={TITLE_MAX}
                    placeholder={
                      kind === "idea"
                        ? "A short summary of your idea"
                        : "What went wrong?"
                    }
                    className="fbkit-input"
                    required
                  />
                </label>

                <label className="fbkit-field fbkit-field--last">
                  <span className="fbkit-field-label">
                    Details{" "}
                    <span className="fbkit-field-label-optional">
                      (optional)
                    </span>
                  </span>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={DETAILS_MAX}
                    rows={4}
                    placeholder={
                      kind === "idea"
                        ? "Any extra context that would help"
                        : "Steps to reproduce, what you expected, what happened"
                    }
                    className="fbkit-textarea"
                  />
                  <div className="fbkit-counter">
                    {details.length}/{DETAILS_MAX}
                  </div>
                </label>

                {error ? (
                  <div role="alert" className="fbkit-error">
                    {error}
                  </div>
                ) : null}

                <div className="fbkit-actions">
                  <button
                    type="button"
                    onClick={close}
                    className="fbkit-btn fbkit-btn--ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="fbkit-btn fbkit-btn--primary"
                  >
                    {submitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

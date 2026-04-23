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
    // Delay reset so the closing transition doesn't flash.
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
        // Swallow — we already surface the original error to the user.
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
          // Only auto-report true server errors, not validation or rate-limit.
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

  const triggerPositionClass = inline
    ? ""
    : position === "bottom-left"
      ? "fixed bottom-5 left-5 z-[9998]"
      : "fixed bottom-5 right-5 z-[9998]";

  const triggerClasses = [
    triggerPositionClass,
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
    "bg-neutral-900 text-white shadow-lg hover:bg-neutral-800",
    "focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2",
    "transition-colors",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClasses}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">💬</span>
        <span>Feedback</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onBackdropKey}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl"
                  aria-hidden="true"
                >
                  ✓
                </div>
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-neutral-900"
                >
                  Thanks — we got it
                </h2>
                <p className="text-sm text-neutral-600">
                  {kind === "idea"
                    ? "Your idea has been posted for the team to review."
                    : "The bug has been logged. We'll take a look."}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold text-neutral-900"
                  >
                    Send feedback
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    aria-label="Close"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>

                <div
                  className="mb-4 inline-flex rounded-lg bg-neutral-100 p-1"
                  role="tablist"
                >
                  {(["idea", "bug"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={kind === k}
                      onClick={() => setKind(k)}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        kind === k
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900",
                      ].join(" ")}
                    >
                      {k === "idea" ? "💡 Idea" : "🐛 Bug"}
                    </button>
                  ))}
                </div>

                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700">
                    Title
                  </span>
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
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                    required
                  />
                </label>

                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700">
                    Details{" "}
                    <span className="font-normal text-neutral-400">
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
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  />
                  <div className="mt-1 text-right text-xs text-neutral-400">
                    {details.length}/{DETAILS_MAX}
                  </div>
                </label>

                {error ? (
                  <div
                    role="alert"
                    className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
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

# Changelog

All notable changes to this package will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] — 2026-04-23

### Changed

- First release published via the tag-based GitHub Actions workflow (prior releases were published manually from a local machine). Future releases cut by pushing a `v*` tag will be signed with npm provenance attestations.

## [0.2.1] — 2026-04-23

### Fixed

- Canny user upsert endpoint URL corrected from `users/retrieve_or_create` (non-existent, returned Canny's marketing 404 page) to `users/create_or_update`. The old behavior surfaced a 20 KB HTML blob as the widget's error message.

### Changed

- Upstream error response bodies are now truncated to 300 characters before being embedded in error messages, across all three integration paths (Canny user, Canny post, Linear issue).

## [0.2.0] — 2026-04-23

### Changed

- **Styling is no longer Tailwind-dependent.** `FeedbackButton` now injects its own scoped CSS (classes prefixed with `fbkit-`) into `<head>` on first mount, via a single idempotent `<style>` element. Works in apps with any styling stack, including plain global CSS.
- Theming supported via CSS custom properties: `--fbkit-accent`, `--fbkit-accent-hover`, `--fbkit-radius`.

### Removed

- Tailwind `content` glob configuration requirement for consumers. README updated accordingly.

## [0.1.0] — 2026-04-23

Initial scaffold (not published to npm).

### Added

- `FeedbackButton` client component — floating pill with Idea/Bug toggle, title + details form, Esc-to-close, autofocus, validation (title 3–200 chars, details < 5000 chars), success state, and auto-reporting of widget failures via a single Linear bug per session.
- Next.js App Router route handler at `/server` subpath — `export { POST } from "..."` pattern plus a `createPOST(config)` factory for explicit configuration.
- Framework-agnostic core: `submitFeedback`, `checkRateLimit`, `validateFeedbackPayload`.
- Canny integration: ideas dispatch to `posts/create`, author upserted via shared anonymous user when no identity is passed.
- Linear integration: bugs filed via GraphQL `issueCreate`, description enriched with user identity + URL + path + user-agent + viewport + timestamp.
- In-memory per-IP rate limiting: 5 requests per 10 minutes.
- Dual ESM + CJS build with `.d.ts` / `.d.cts` types via tsup, including an `onSuccess` hook that preserves the `"use client"` directive at the top of both client bundles (directives are otherwise stripped during bundling).

[0.2.2]: https://github.com/JamesHankinsDev/feedback-kit/releases/tag/v0.2.2
[0.2.1]: https://github.com/JamesHankinsDev/feedback-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/JamesHankinsDev/feedback-kit/releases/tag/v0.2.0
[0.1.0]: https://github.com/JamesHankinsDev/feedback-kit/releases/tag/v0.1.0

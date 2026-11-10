// Runs on the client after the HTML loads but before React hydration (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md).
//
// Zod is no longer loaded in the client-side bundle (schema parsing occurs server-side only).
//
// TE-04 (front-end audit, Josh's card 5, 5 Nov 2026): browser error counts, error type, screen
// (route template), release and desk role only, never messages or record text
// (src/lib/browser-error-report.ts). The server log receives them from /api/client-error.
//
// The reporter loads as its own small chunk after start-up, so it adds nothing to each screen's
// first download (phone size limits, D-82).

// Written by next.config.ts at build time: SENTRY_RELEASE or the Railway commit, else "dev".
declare const __WARD_RELEASE__: string | undefined;

if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
  const release = typeof __WARD_RELEASE__ === "string" ? __WARD_RELEASE__ : "dev";
  void import("./lib/browser-error-report")
    .then(({ installBrowserErrorReport }) => installBrowserErrorReport(window, release))
    .catch(() => {});
}

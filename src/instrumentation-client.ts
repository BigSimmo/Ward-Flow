// Runs on the client after the HTML loads but before React hydration (see
// node_modules/next/dist/docs/.../instrumentation-client.md).
//
// Zod is no longer loaded in the client-side bundle (schema parsing occurs server-side only).
//
// TODO(front-end audit TE-04, Josh's card 5, 5 Nov 2026): browser error counts go to the workspace
// monitor, error type and screen (route template) only, never messages or record text. Not done
// yet: the workspace monitor on main (.github/workflows/backend-uptime.yml) is a scheduled sign-in
// check with no endpoint that can receive counts. It needs a small backend receiver first (rate
// limited, allow-listed fields, like backend/ward-flow/error-report.mjs). Add the `error` and
// `unhandledrejection` listeners here once that exists.

export {};

// Runs on the client after the HTML loads but before React hydration (see
// node_modules/next/dist/docs/.../instrumentation-client.md).
//
// Zod is no longer loaded in the client-side bundle (schema parsing occurs server-side only).

if (process.env.NEXT_PUBLIC_WARD_CLIENT_ERROR_REPORTING === "true") {
  const report = (error: unknown) => {
    void import("./components/ward-management/ward-client-errors")
      .then(({ reportBrowserError }) => reportBrowserError(error))
      .catch(() => {});
  };
  window.addEventListener("error", (event) => report(event.error));
  window.addEventListener("unhandledrejection", (event) => report(event.reason));
}

export {};

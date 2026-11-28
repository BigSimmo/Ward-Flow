"use client";

import { useEffect, useRef } from "react";
import { useCopyDiagnostics } from "@/lib/use-copy-diagnostics";

/**
 * Last-resort boundary for the App Router. Unlike `app/error.tsx`, this replaces
 * the root layout entirely, so it is the ONLY thing that can recover from an
 * error thrown in `app/layout.tsx` itself or its providers (AuthProvider, fonts,
 * WebVitalsReporter). Because it renders in place of the root layout, `globals.css`
 * is NOT applied — it must supply its own <html>/<body> and inline styles so it
 * still renders correctly when the styling/theming system is exactly what failed.
 * H-0349: "Try again" calls Next 16's `retry`, which re-fetches; `reset` would only re-render.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { copied, copyFailed, copyDiagnostics } = useCopyDiagnostics(error);

  useEffect(() => {
    // TE-12 (front-end audit, 5 Nov 2026): production logs the type and digest only, never the
    // message, which can carry record content. Development logs the whole object with its stack.
    console.error(
      "Fatal error captured by global-error boundary:",
      process.env.NODE_ENV === "production" ? { name: error.name, digest: error.digest } : error,
    );
    headingRef.current?.focus({ preventScroll: true });
  }, [error]);

  // Audit four #12 (28 Nov 2026): drawn like the Page not found card (same card, icon tile and type),
  // with one filled Try again, a quiet Reload page and Copy diagnostics as a text link. Self-contained:
  // the app stylesheet may be what failed, so its colours are written here, light and dark, from the
  // app's own palette. The title is still focused and announced, without a visible focus box.
  return (
    <html lang="en-AU">
      <head>
        <style>{GLOBAL_ERROR_CSS}</style>
      </head>
      <body className="ge-body">
        <main className="ge-card">
          <div className="ge-icon" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 ref={headingRef} tabIndex={-1} role="alert" className="ge-title">
            Something went wrong
          </h1>
          <p className="ge-text">The application failed to load. Try again, or reload the page.</p>
          {error.digest && <p className="ge-ref">Error reference: {error.digest}</p>}
          <div className="ge-actions">
            <button type="button" className="ge-btn ge-pri" onClick={() => retry()}>
              Try again
            </button>
            <button type="button" className="ge-btn ge-sec" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
          <button type="button" className="ge-link" onClick={copyDiagnostics}>
            {copied ? "Diagnostics copied" : copyFailed ? "Copy failed. Try again" : "Copy diagnostics"}
          </button>
        </main>
      </body>
    </html>
  );
}

/** The card's own styles: BedChart's palette written out, as the app stylesheet may not have loaded. */
const GLOBAL_ERROR_CSS = `
.ge-body{--bg:#e8ecf0;--card:#fdfdfe;--line:rgba(22,30,40,.15);--ink:#161a20;--ink2:#414953;--ink3:#5b646f;--tile:rgba(79,115,152,.14);--tileInk:#4f7398;--p1:#2f6aa3;--p2:#234f7a;--onp:#fff;--focus:#245a8c;--well:rgba(22,30,40,.05);
margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;color-scheme:light dark;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme:dark){.ge-body{--bg:#0d141b;--card:#141d26;--line:rgba(255,255,255,.13);--ink:#e9eef3;--ink2:#bcc8d4;--ink3:#93a4b5;--tile:rgba(127,163,200,.16);--tileInk:#7fa3c8;--p1:#3a72a8;--p2:#2c5c8c;--focus:#8cbcf0;--well:rgba(255,255,255,.05)}}
.ge-card{width:100%;max-width:28rem;box-sizing:border-box;border:1px solid var(--line);border-radius:1rem;background:var(--card);padding:1.5rem;text-align:center;box-shadow:0 10px 30px rgba(10,20,30,.12)}
.ge-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;margin:0 auto;border-radius:50%;background:var(--tile);color:var(--tileInk)}
.ge-title{margin:1rem 0 0;font-size:1.125rem;line-height:1.5rem;font-weight:600;letter-spacing:-.01em;outline:none}
.ge-text{margin:.5rem 0 0;font-size:.875rem;line-height:1.6;color:var(--ink2)}
.ge-ref{margin:1rem 0 0;padding:.5rem .75rem;border-radius:.5rem;background:var(--well);font:.75rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink2);word-break:break-all}
.ge-actions{display:flex;flex-direction:column;gap:.5rem;margin-top:1.5rem}
.ge-btn{min-height:40px;padding:0 1rem;border-radius:12px;font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer}
.ge-pri{border:0;background:linear-gradient(180deg,var(--p1),var(--p2));color:var(--onp)}
.ge-sec{border:1px solid var(--line);background:transparent;color:var(--ink)}
.ge-link{margin-top:.75rem;padding:.25rem .5rem;border:0;background:none;color:var(--ink3);font-family:inherit;font-size:.8125rem;font-weight:500;line-height:1.4;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.ge-btn:focus-visible,.ge-link:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
`;

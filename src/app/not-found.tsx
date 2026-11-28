import type { Metadata } from "next";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { ContextualBackLink } from "@/components/contextual-back-link";

// Design audit DA-28: the tab named only "Ward Flow" on a missing page.
export const metadata: Metadata = {
  title: "Page not found — BedChart",
};

export default function NotFound() {
  return (
    // H-0882 (26 Oct 2026): the page had no main landmark, so the skip link went nowhere.
    // Gate r10 F7: the page ground is the one canvas (item 88), so dark is #0d141b, not grey.
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--wf-canvas,var(--surface-lux))] px-4 font-sans text-[color:var(--text)]"
    >
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--wf-surface,var(--surface-raised))] p-6 shadow-[var(--shadow-elevated)] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--info-soft)] text-[color:var(--info)]">
          <FileQuestion aria-hidden="true" className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[color:var(--text-heading)]">Page not found</h1>

        <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed [text-wrap:balance]">
          {/* Audit four #82: the same sentence as the in-app card. */}
          This page is not in BedChart. The link may be wrong or out of date.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <ContextualBackLink
            fallbackHref="/bedchart"
            // Q197 (Josh, 1 Nov 2026): the accent button of the in-app not-found card, not the black one.
            // Drawn as the kit filled button (pri gradient, on-pri ink): white on the dark-mode accent failed 4.5:1.
            className="flex min-h-10 items-center justify-center gap-2 rounded-[var(--wf-r-ctl)] bg-[linear-gradient(180deg,var(--wf-pri-1),var(--wf-pri-2))] px-4 py-2 text-sm font-semibold text-[color:var(--wf-on-pri)] no-underline"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to BedChart
          </ContextualBackLink>
        </div>
      </div>
    </main>
  );
}

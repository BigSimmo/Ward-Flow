"use client";

import { ArrowLeft, FileQuestion } from "lucide-react";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { cn, primaryControl } from "@/components/ui-primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--surface-lux)] px-4 font-sans text-[color:var(--text)]">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 shadow-[var(--shadow-elevated)] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--info-soft)] text-[color:var(--info)]">
          <FileQuestion aria-hidden="true" className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[color:var(--text-heading)]">Page not found</h1>

        <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
          The page you are looking for does not exist or may have been moved. Check the address, or return to Ward Flow.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <ContextualBackLink
            fallbackHref="/mockups/ward-flow"
            className={cn(primaryControl, "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium")}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to Ward Flow
          </ContextualBackLink>
        </div>
      </div>
    </div>
  );
}

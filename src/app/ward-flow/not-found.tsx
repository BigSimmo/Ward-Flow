import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";

import notFoundStyles from "@/components/ward-management/ward-movement-not-found.module.css";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";

// The tab title every Ward Flow page ends with (design audit DA-28).
export const metadata: Metadata = {
  title: "Page not found — Ward Flow",
};

/**
 * ST3 (design audit, 5 Nov 2026): a Ward Flow page that calls `notFound()` (a ward, board, ED,
 * community team or statistics page whose id matches nothing) fell through to the host's own 404,
 * which replaced the Ward Flow shell. This one renders inside the ward layout, so the header, rail
 * and dock stay, with the one not-found pattern (shell-12): a title, one plain sentence that never
 * quotes the address, the way back to Home and the patient search. The movement and patient
 * not-found pages stay nearer and keep their own wording.
 */
export default function WardFlowNotFound() {
  return (
    <main id="main-content" data-testid="ward-flow-not-found">
      <div className={notFoundStyles.card}>
        <span className={notFoundStyles.icon} aria-hidden="true">
          <FileQuestion size={24} aria-hidden="true" />
        </span>
        <WardNotFoundBody title="Page not found" list={{ href: "/ward-flow", label: "Home" }}>
          This page is not in Ward Flow. The link may be wrong or out of date.
        </WardNotFoundBody>
      </div>
    </main>
  );
}

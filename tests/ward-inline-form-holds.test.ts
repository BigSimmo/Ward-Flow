import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Audit CS3-01: in shared mode an edit form must be checked against the board it opened on, so a
 * change another desk made while the person was looking is reported, not overwritten (legal status
 * decides which ward may lawfully take the person). A form is covered in one of three ways:
 *
 * - held: it calls `useHoldOpenForm` (or `holdOpenForm`) while it is open;
 * - page form: its fields and its save button sit inside one `<form>` on the page, which the shared
 *   board holds from the first touch (`sheet-focus.ts`, `holdUsedForm`);
 * - popup: it only opens inside a Sheet, Drawer, Dialog or modal, which the board already holds.
 *
 * "follow-up" marks a form whose hold waits on another piece of work in the same file; say which.
 *
 * Every file that both saves to the shared board and opens an edit form is listed below with its
 * cover. A new one fails here until someone decides which cover it has.
 */
const ROOT = path.join(process.cwd(), "src/components/ward-management");

type Cover = "held" | "page form" | "popup" | "no form" | "follow-up";
const REGISTER: Record<string, { cover: Cover; why?: string; formIn?: string }> = {
  "alerts/alerts-screen.tsx": { cover: "popup", why: "Broadcast and alert detail open in modals." },
  "board/ward-board-detail-panel.tsx": { cover: "page form" },
  "board/ward-board-ward-diagnosis.tsx": { cover: "page form" },
  "capacity/ward-closure-panel.tsx": { cover: "held", why: "Held once a reason or reopening time is chosen." },
  "board/ward-board.tsx": { cover: "popup", why: "Departure and release confirms are modal." },
  "community/community-screen.tsx": { cover: "held" },
  "community/use-community-screen-overlays.ts": { cover: "popup", why: "Transport booking is a modal sheet." },
  "coordinator/coordinator-screen.tsx": { cover: "popup", why: "Exceptions open in a sheet." },
  "coordinator/missed-requests-panel.tsx": { cover: "no form", why: "A fold with a seen tick, no fields." },
  "coordinator/shortlist-panel.tsx": { cover: "held" },
  "discharges/discharge-care-journey.tsx": { cover: "page form" },
  "discharges/discharge-detail-panes.tsx": { cover: "page form" },
  "discharges/discharge-follow-up.tsx": { cover: "page form" },
  "discharges/use-discharge-workspace-state.tsx": {
    cover: "page form",
    formIn: "discharges/discharge-detail-panes.tsx",
  },
  "ed/ed-screen-row-forms.tsx": { cover: "popup", why: "Row forms render in the person sheet (A2)." },
  "ed/ed-screen-row-menu.tsx": { cover: "popup" },
  "ed/ed-screen.tsx": { cover: "popup", why: "The person sheet holds the row forms." },
  "ed/use-ed-screen-decline.ts": { cover: "held" },
  "ed/use-ed-screen-state.ts": { cover: "held" },
  "forecast/forecast-miss-reason-control.tsx": { cover: "held" },
  "governance-registers.tsx": { cover: "popup" },
  "handover/handover-page.tsx": { cover: "popup" },
  "hub/hub-screen.tsx": { cover: "popup" },
  "legal-forms/legal-forms-screen.tsx": { cover: "popup", why: "Record a form opens in a sheet." },
  "loop-checks/ward-closure-loop-checks.tsx": { cover: "held" },
  "movements/movement-workflow-actions.tsx": { cover: "page form" },
  "movements/movement-workspace-cockpit.tsx": { cover: "held" },
  "movements/sent-journey-changes.tsx": { cover: "held" },
  "movements/support-notification-checklist.tsx": { cover: "held" },
  "officer/officer-screen.tsx": { cover: "held", why: "The diversion form renders in officer-job-detail.tsx." },
  "out-of-area/home-service-return-panel.tsx": { cover: "page form" },
  "patients/add-patient.tsx": { cover: "popup" },
  "patients/patient-now-screen.tsx": { cover: "popup", why: "Clearance and transport edit in modals." },
  "patients/patient-transit-operations.tsx": { cover: "page form" },
  "referrals/arrival-time-modal.tsx": { cover: "popup" },
  "referrals/referral-ask-more-wards.tsx": { cover: "held" },
  "referrals/referral-board.tsx": { cover: "popup", why: "Phone patient and timeline open in sheets." },
  "referrals/pull-accepted-referral.tsx": {
    cover: "page form",
    why: "Stream B's pull form: fields and Pull the bed sit in one form.",
  },
  "referrals/upload-forms-modal.tsx": { cover: "popup" },
  "referrals/use-referral-match-state.tsx": { cover: "held" },
  "referrals/use-ward-referral-drawer-state.ts": { cover: "popup" },
  "settings/settings-screen.tsx": { cover: "popup" },
  "use-hold-open-form.ts": { cover: "held", why: "The hook itself." },
  "ward-global-search.tsx": { cover: "no form", why: "Search only; it saves nothing to a record." },
  "ward-shared-access.tsx": { cover: "no form", why: "Sign-in, not a shared board save." },
  "ward-tasks-drawer.tsx": { cover: "popup" },
  "ward/ward-accepted-referral-placement-form.tsx": { cover: "page form" },
  "ward/ward-answer-view.tsx": { cover: "held" },
  "ward/ward-arrivals-corridor.tsx": { cover: "page form" },
  "ward/ward-bed-dossier-drawer.tsx": { cover: "popup", why: "The bed drawer is modal." },
  "ward/ward-bed-move-reason-form.tsx": { cover: "held" },
  "ward/ward-discharge-criteria-card.tsx": { cover: "held" },
  "ward/ward-leave-paper-authority.tsx": { cover: "popup", why: "Opens only inside the bed drawer (WT-02)." },
  "ward/ward-drawer-discharge-date.tsx": { cover: "popup", why: "Opens only inside the bed drawer (WT-16)." },
  "ward/ward-observation-control.tsx": { cover: "held" },
  "ward/ward-screen.tsx": { cover: "held" },
};

const SAVES =
  /WardCommandDispatch|WardCommandOutcome|\b(dispatch|dispatchConfirmed|raise)\s*\(|wardRaise\(|\braise\b\s*=|\bdispatch\b[,}]/;
const OPENS = /const \[((?:open|editing)|\w*(?:[oO]pen|[oO]penFor|[eE]diting|Draft|[cC]onfirm)), set\w*\] = useState/;
const HELD = /\b(useHoldOpenForm|holdOpenForm)\(/;
const FORM = /<form\b/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

const found = new Map<string, string>();
for (const file of sources(ROOT)) {
  const text = readFileSync(file, "utf8");
  if ((SAVES.test(text) && (OPENS.test(text) || FORM.test(text))) || HELD.test(text))
    found.set(path.relative(ROOT, file).split(path.sep).join("/"), text);
}

describe("every inline edit form is checked against the board it opened on (audit CS3-01)", () => {
  it("lists every file that saves to the shared board from an edit form", () => {
    const unlisted = [...found.keys()].filter((file) => !(file in REGISTER));
    expect(unlisted, "Add each to REGISTER with how it is held (see the comment at the top)").toEqual([]);
  });

  it("lists no file that has stopped saving from a form", () => {
    expect(Object.keys(REGISTER).filter((file) => !found.has(file))).toEqual([]);
  });

  it("holds each form listed as held, and keeps each page form inside a <form>", () => {
    for (const [file, { cover, formIn }] of Object.entries(REGISTER)) {
      if (cover === "held") expect(HELD.test(found.get(formIn ?? file) ?? ""), file).toBe(true);
      if (cover === "page form") expect(FORM.test(found.get(formIn ?? file) ?? ""), file).toBe(true);
    }
  });
});

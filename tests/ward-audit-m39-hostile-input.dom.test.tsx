// tests/ward-audit-m39-hostile-input.dom.test.tsx
//
// Audit item M39: hostile input. A fixed set of hostile strings (script, markup with event
// handlers, a query, a template, a spreadsheet formula and unsafe links) is pushed through the
// paths a typed value travels: save (the backend engine and the reducer), reload (stored JSON
// validation), display (the written history, corrections and referrer contact), copy and print
// (the ISBAR summary) and errors (a refusal that echoes what was typed). It must come back as the
// same literal text every time: never markup, never a live link, never a changed meaning.
// CSV export escaping is proven elsewhere (tests that cover the CSV writers) and is not repeated.
// Synthetic strings only.

import "@testing-library/jest-dom/vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCommand, seedWorld } from "../backend/ward-flow/engine";
import { isbarText, IsbarSheet } from "@/components/ward-management/referrals/referral-board-sheets";
import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardNotificationCenter } from "@/components/ward-management/ward/ward-notification-center";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import type { Notice } from "@/components/ward-management/ward-model-notices";
import { PatientTab } from "@/components/ward-management/referrals/referral-panel-tabs";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RECEIVE_REFERRAL_CANDIDATE } from "./helpers/ward-legal-figure-sweep";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ward-flow/coordinator",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  delete (window as { __m39?: unknown }).__m39;
});

/** The hostile set. Each would do something if any path treated it as markup, code or a link. */
const HOSTILE = [
  "<script>window.__m39=1</script>",
  '<img src=x onerror="window.__m39=1">',
  '"><svg onload=window.__m39=1>',
  "javascript:window.__m39=1",
  "data:text/html,<script>window.__m39=1</script>",
  "' OR 1=1; DROP TABLE ward_commands; --",
  "{{constructor.constructor('window.__m39=1')()}} ${window.__m39=1}",
  '=HYPERLINK("https://example.invalid","synthetic")',
] as const;
const ALL = HOSTILE.join("\n");
const at = new Date("2026-10-19T10:00:00Z");

/** A valid synthetic intake (shape from tests/helpers/ward-typed-text-fixtures.ts). */
const INTAKE = {
  catchment: { teamName: "Synthetic catchment team", service: "East Metro", confirmed: true },
  reasonForReferral: "Synthetic reason",
  legalStatus: "Voluntary",
  riskFlags: [],
  medicalClearance: {
    cleared: false,
    expectedAt: "2026-10-23T05:37+08:00",
    contactName: "Synthetic contact",
    contactPhone: "Synthetic-phone-0000",
  },
  triageAndRampCompleted: false,
  additionalDocuments: false,
  charts: [
    { kind: "medication", name: "synthetic-medication.pdf", mimeType: "application/pdf", sizeBytes: 3, base64: "JVBE" },
    {
      kind: "observation",
      name: "synthetic-observation.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      base64: "JVBE",
    },
  ],
  referrer: {
    name: "Synthetic referrer",
    email: "referrer@example.invalid",
    phone: "08 5550 0001",
    role: "Registrar",
    location: "Synthetic ED",
  },
  arrival: { transport: "Ambulance", reference: "SYN-1" },
  clearanceChecklist: {},
  needs: { kind: "ed", comingBy: "Ambulance", medicalReviewFirst: true },
};

/** Nothing in the rendered tree became markup, a handler or an executable link. */
function expectInert(root: ParentNode) {
  expect(root.querySelectorAll("script, img, svg[onload], iframe, object, embed")).toHaveLength(0);
  for (const element of root.querySelectorAll("*"))
    for (const attribute of element.attributes)
      expect(attribute.name, `on* attribute on <${element.tagName}>`).not.toMatch(/^on/i);
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")!;
    expect(href, "an anchor href").toMatch(/^(\/|#|tel:|mailto:|data:(application\/pdf|image\/png|image\/jpeg);)/);
    expect(href).not.toMatch(/^\s*(javascript|vbscript|data:text):/i);
  }
  expect((window as { __m39?: unknown }).__m39).toBeUndefined();
}

function savedReferral(history: string, intake: unknown = INTAKE): { state: WardFlowState; referral: Referral } {
  const result = applyCommand(
    seedWorld(at),
    { ...RECEIVE_REFERRAL_CANDIDATE, type: "RECEIVE_REFERRAL", role: "community", now: 642, history, intake },
    at,
  );
  if (result.outcome !== "accepted") throw new Error(`refused: ${JSON.stringify(result)}`.slice(0, 600));
  // Reload: the stored JSON must still validate and carry the literal text.
  const state = JSON.parse(JSON.stringify(result.world.state)) as WardFlowState;
  expect(isValidStoredWardFlowState(state)).toBe(true);
  return { state, referral: state.referrals.at(-1)! };
}

describe("M39 hostile input", () => {
  it("saves and reloads every hostile string as the same literal text", () => {
    for (const value of [...HOSTILE, ALL]) expect(savedReferral(value).referral.history).toBe(value);
  });

  it("stores a hostile correction note literally and shows history and notes as text, never markup", () => {
    const { state, referral } = savedReferral(ALL);
    let next = state;
    for (const note of HOSTILE) {
      const after = wardFlowReducer(next, {
        type: "ADD_REFERRAL_CORRECTION",
        role: "coordinator",
        now: NOW_ANCHOR + 1,
        referralId: referral.id,
        note,
      });
      expect(after.rejections.length, `correction ${note}`).toBe(next.rejections.length);
      next = after;
    }
    const stored = next.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(stored.corrections?.map((correction) => correction.note)).toEqual([...HOSTILE]);

    const { container, getByTestId } = render(
      <ReferralHistoryAndCorrections referral={stored} now={NOW_ANCHOR} readOnly />,
    );
    expect(getByTestId("ward-referral-history-text").textContent).toBe(ALL);
    for (const note of HOSTILE) expect(container.textContent).toContain(note);
    expectInert(container);
  });

  it("refuses a referrer phone that is not a phone number, at the engine", () => {
    // Audit M39 (Josh, 10 Nov 2026): a direct command, as a hostile client would send it.
    for (const phone of [HOSTILE[3], HOSTILE[0], "Synthetic-phone-0001", "no digits"]) {
      const hostileIntake = { ...INTAKE, referrer: { ...INTAKE.referrer, phone } };
      const result = applyCommand(
        seedWorld(at),
        {
          ...RECEIVE_REFERRAL_CANDIDATE,
          type: "RECEIVE_REFERRAL",
          role: "community",
          now: 642,
          history: "Synthetic history",
          intake: hostileIntake,
        },
        at,
      );
      expect(result.outcome, phone).not.toBe("accepted");
      expect(JSON.stringify(result)).toContain("Enter a phone number in digits, or leave it blank.");
    }
    // Blank and part-typed numbers still send (FORM-REF warns about them, never blocks).
    for (const phone of ["", "0412"]) {
      const { referral } = savedReferral("Synthetic history", { ...INTAKE, referrer: { ...INTAKE.referrer, phone } });
      expect(referral.intake?.referrer.phone).toBe(phone);
    }
  });

  it("shows an unsafe referrer phone from an older record as text, with no dial link (A15-14)", () => {
    // Stored referrals are not re-checked, so one saved before M39 still renders inert.
    const { referral: saved } = savedReferral("Synthetic history", { ...INTAKE, reasonForReferral: HOSTILE[0] });
    const referral = {
      ...saved,
      intake: {
        ...saved.intake!,
        referrer: { name: HOSTILE[1], role: HOSTILE[2], location: HOSTILE[5], phone: HOSTILE[3], email: HOSTILE[4] },
      },
    } as Referral;
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientTab referral={referral} now={NOW_ANCHOR} personName={HOSTILE[6]} readOnly />
      </WardFlowProvider>,
    );
    expect(container.textContent).toContain(HOSTILE[3]);
    // A15-14 (13 Nov 2026): demo numbers are copy only, so no tel: link carries the text at all.
    expect(container.querySelector("a[href^='tel:']")).toBeNull();
    expectInert(container);
  });

  it("prints and copies the ISBAR summary with hostile text as literal text", () => {
    const { referral } = savedReferral(ALL);
    const text = isbarText(referral, HOSTILE[0], "UM000000", HOSTILE[7], NOW_ANCHOR);
    expect(text).toContain(HOSTILE[0]);
    const { baseElement } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <IsbarSheet
          open
          onClose={() => {}}
          referral={referral}
          name={HOSTILE[0]}
          umrn="UM000000"
          demographics={HOSTILE[7]}
          now={NOW_ANCHOR}
        />
      </WardFlowProvider>,
    );
    expect(baseElement.textContent).toContain(HOSTILE[0]);
    expectInert(baseElement);
  });

  it("refuses a document that is not a PDF or picture, so no data: page can be opened from a referral", () => {
    const base = { ...RECEIVE_REFERRAL_CANDIDATE, type: "RECEIVE_REFERRAL", role: "community", now: 642 };
    const { referral } = savedReferral("Synthetic history");
    expect(referral.intake?.charts).toHaveLength(2);
    const html = { kind: "other", name: "synthetic.html", mimeType: "text/html", sizeBytes: 3, base64: "PGI+" };
    const result = applyCommand(
      seedWorld(at),
      {
        ...base,
        history: "Synthetic history",
        intake: { ...INTAKE, charts: [INTAKE.charts[0], { ...html, kind: "observation" }] },
      },
      at,
    );
    expect(result.outcome).not.toBe("accepted");
    expect(applyCommand(seedWorld(at), { ...base, history: "Synthetic history", intake: INTAKE }, at).outcome).toBe(
      "accepted",
    );
  });

  it("echoes hostile input in a refusal as plain text", () => {
    const { state } = savedReferral("Synthetic history");
    const movement = state.movements.find((candidate) => !candidate.closure)!;
    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: movement.id,
      team: HOSTILE[0],
    });
    const reason = after.rejections.at(-1)?.reason ?? "";
    expect(after.rejections.length).toBe(state.rejections.length + 1);
    const { container } = render(<p>{reason}</p>);
    expect(container.textContent).toBe(reason);
    expectInert(container);
  });

  it("shows a hostile typed name on the Alerts screen as plain text only", () => {
    const state = JSON.parse(JSON.stringify(seedWardFlowState())) as WardFlowState;
    // WF-015 raises two alerts (transport time passed) in the seed; give its patient hostile names.
    const patient = state.patients.find((p) => p.id === state.movements.find((m) => m.id === "WF-015")!.patientId)!;
    patient.givenName = HOSTILE[1];
    patient.familyName = HOSTILE[0];
    const connection = {
      enabled: true,
      signedIn: true,
      actorId: "synthetic-shared-account",
      access: { role: "coordinator", scope: { kind: "statewide" } },
      status: "ready",
      error: null,
      eventLog: [],
      receivedAt: Date.now(),
      snapshot: {
        accessContext: "a".repeat(64),
        dataMode: "prototype",
        revision: 1,
        now: NOW_ANCHOR,
        payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
      },
      dispatch: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
    } as unknown as WardSharedConnection;
    const { container } = render(
      <WardFlowProvider sharedConnection={connection}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    expect(container.textContent, "the hostile name is on screen as literal text").toContain(HOSTILE[0]);
    expectInert(container);
  });

  it("shows a hostile buzz message and notice sentence as plain text only", () => {
    const notice: Notice = {
      id: "N-SYN-1",
      raisedAt: NOW_ANCHOR - 5,
      to: { role: "ward", placeId: "ward-alpha" },
      about: { unitId: "ward-alpha" },
      kind: "referral_declined",
      sentence: ALL,
    };
    const { baseElement } = render(
      <WardNotificationCenter
        unitId="ward-alpha"
        unitName={HOSTILE[2]}
        now={NOW_ANCHOR}
        movements={[]}
        notices={[notice]}
        refreshRequests={[
          { unitId: "ward-alpha", at: NOW_ANCHOR - 5, byRole: "coordinator", message: ALL, urgent: true },
        ]}
      />,
    );
    expect(baseElement.textContent, "the buzz is on screen as literal text").toContain(HOSTILE[0]);
    expectInert(baseElement);
  });

  it("has no path in the app source that writes a string into the page as HTML or code", () => {
    const root = join(process.cwd(), "src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(path);
      }
    };
    walk(root);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\bnew Function\(|\beval\(/.test(source))
        offenders.push(file);
      // Only fixed scripts written by the app itself may use dangerouslySetInnerHTML.
      for (const match of source.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g))
        if (!/^[A-Z_]+(?:_SCRIPT)?\s*$/.test(match[1]!.trim()) && !file.endsWith(join("app", "layout.tsx")))
          offenders.push(`${file}: ${match[1]!.trim()}`);
    }
    expect(offenders).toEqual([]);
  });
});

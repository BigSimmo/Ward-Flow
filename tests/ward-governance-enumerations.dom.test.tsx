import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `useSearchParams` returns null without an App Router context, so the screens here get a mock.
vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * GOVERNANCE PARAGRAPHS THAT ENUMERATE WHAT A SCREEN DOES MUST NAME EVERYTHING IT DOES.
 *
 * ⚠️ THE CLASS. Three screens told a clinician what they record or show, the code later gained a
 * category, and the sentence was never touched:
 *
 *   patient-search    named people and open movements; also renders QUEUED REFERRALS, first
 *   referral-intake   named five facts and the request; the payload also writes `patientId`
 *   officer-screen    said "every transport job not yet arrived"; the filter also drops CLOSED ones
 *
 * ⚠️ AND THE DIRECTION IS THE OPPOSITE OF THE USUAL FAILURE HERE. The defect this project keeps
 * finding is a change propagated into the comments that stops before the rendered page. These are
 * changes that reached the CODE and never touched the sentence at all. Same missing step, other
 * way round — which is why neither a comment audit nor a code audit alone would have found them.
 *
 * ⚠️ EACH REPAIR GETS TWO INDEPENDENT ASSERTIONS: one that the BEHAVIOUR is what we think, and one
 * that the SENTENCE says so. A wording pin alone is worthless — it goes green the moment somebody
 * rephrases and red the moment somebody improves. Paired with a driven behaviour assertion, a
 * mutation to either half turns exactly one of them red, and the pair tells you which half moved.
 */

afterEach(cleanup);

function renderIn(node: ReactNode) {
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

describe("the officer screen's sentence and its filter agree", () => {
  /** A job that has not arrived, on a movement that has closed — the only shape that discriminates. */
  const withTransport = wardMovements.find((movement) => movement.transport !== undefined);
  /**
   * A REAL closure, lifted from the fixture rather than written here. A hand-built one would encode
   * my belief about `MovementClosure`'s shape, and a test that carries its own idea of a type is a
   * mirror — it keeps passing after the type moves underneath it.
   */
  const realClosure = wardMovements.find((movement) => movement.closure !== undefined)?.closure;

  it("has a seeded movement carrying a transport job, and a real closure to borrow", () => {
    expect(withTransport, "no seeded movement has transport, so nothing below discriminates").toBeDefined();
    expect(realClosure, "no seeded movement is closed, so the closed half cannot be built honestly").toBeDefined();
  });

  it("BEHAVIOUR: drops a not-yet-arrived job once its movement closes", () => {
    const source = withTransport as Movement;
    const open: Movement = {
      ...source,
      closure: undefined,
      transport: { ...source.transport!, arrivedAt: undefined },
    };
    const closed: Movement = { ...open, closure: realClosure };

    expect(isOfficerJob(open), "an open movement with an unarrived job is exactly what this screen is for").toBe(true);
    expect(
      isOfficerJob(closed),
      "the same unarrived job on a closed movement is excluded — which is correct, and is the thing " +
        "the sentence has to admit to",
    ).toBe(false);
  });

  it("SENTENCE: says the list is scoped to open movements", () => {
    renderIn(<OfficerScreen />);
    const banner = screen.getByTestId("ward-officer-governance").textContent ?? "";
    expect(banner, "the jobs statement no longer says it covers the complete outstanding set").toContain(
      "All outstanding jobs",
    );
    expect(banner, "the jobs statement no longer says closed movements are outside that set").toContain(
      "closed movements excluded",
    );
  });
});

describe("the patient search names every list it renders", () => {
  it("BEHAVIOUR: renders a referral list as well as people and movements", () => {
    renderIn(<PatientSearchPage />);
    // The three result surfaces the page can show. Referrals are rendered FIRST by deliberate
    // decision (the component's own comment: "a referral is somebody still waiting for a decision").
    expect(screen.getByTestId("ward-patient-search-people")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-referrals"), "the omitted category").toBeInTheDocument();
  });

  it("SENTENCE: enumerates referrals alongside people and movements", () => {
    renderIn(<PatientSearchPage />);
    const banner = screen.getByTestId("ward-patient-search-governance").textContent?.toLowerCase() ?? "";
    expect(banner).toContain("people");
    expect(banner).toContain("movements");
    expect(
      banner,
      "referrals are the first list on the page and the most urgent — somebody still waiting for a " +
        "decision. A clinician told the box finds people and movements may go elsewhere to look for them",
    ).toContain("referral");
  });
});

/*
 * "The referral intake names the patient pointer it writes" read the governance banner on the
 * full-page intake form, retired on 8 Oct 2026. The referral slide-out is now the one place a
 * referral is written, so its own suite must pin the same distinction there: a pointer to the
 * person's record is recorded, free text is admitted and scoped to the history, and the structured
 * questions cannot hold a name.
 */

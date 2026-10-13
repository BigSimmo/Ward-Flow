import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Community team on a phone (v10 all-pages mockup, "Community team", Phone; device audit option A,
 * 11 Oct 2026): its own tree with the band hero, tool chips that open sheets, and Waiting / In bed /
 * Back / CTOs one tap apart on one switch with counts. Notices and provenance sit behind one closed
 * "About this data". Every coordinator action stays reachable: intake, record contact, switch team,
 * and accept or decline a waiting referral from its sheet (decline locked until a reason is chosen).
 */

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderTeam() {
  return render(
    <ToastProvider>
      <WardFlowProvider>
        <CommunityScreen teamId="midland" />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function firstOption(select: HTMLElement): string {
  return [...(select as HTMLSelectElement).options].map((option) => option.value).find(Boolean)!;
}

beforeEach(asPhone);
afterEach(() => vi.unstubAllGlobals());

describe("Community team on a phone", () => {
  it("renders the phone tree, not the desktop stack", () => {
    renderTeam();
    expect(screen.getByTestId("ward-community-phone")).toBeInTheDocument();
    expect(screen.getByTestId("ward-community-phone-hero")).toHaveTextContent("on the caseload");
    expect(screen.queryByRole("tablist", { name: "Community team lists" })).not.toBeInTheDocument();
    const lists = screen.getByRole("radiogroup", { name: "Team lists" });
    // One switch, each list with its count (the hero figures that repeated it are gone).
    expect(
      within(lists)
        .getAllByRole("radio")
        .map((radio) => radio.textContent?.replace(/\d+$/u, "").trim()),
    ).toEqual(["Waiting", "In bed", "Back", "CTOs"]);
    expect(screen.queryByTestId("wf-phone-hero-figure-back")).not.toBeInTheDocument();
  });

  it("switches lists from the segmented control and the CTO register chip", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("radio", { name: /^In bed/u }));
    expect(screen.getByTestId("ward-community-phone-list-inBed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Back/u }));
    expect(screen.getByTestId("ward-community-phone-list-back")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-cto"));
    expect(screen.getByTestId("ward-community-phone-list-ctos")).toBeInTheDocument();
  });

  it("opens How to reach and On duty as sheets, and keeps coverage in About this data", () => {
    renderTeam();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-reach"));
    expect(screen.getByTestId("ward-community-contact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-duty"));
    expect(screen.getByTestId("ward-community-roster")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const about = screen.getByTestId("ward-community-about-this-data");
    expect(about).not.toHaveAttribute("open");
    expect(within(about).getByTestId("ward-community-limits")).toBeInTheDocument();
  });

  it("keeps the team actions: record contact and switch team", () => {
    renderTeam();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-contact"));
    expect(screen.getByTestId("ward-community-contact-save")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch team" }));
    expect(screen.getByRole("searchbox", { name: "Find a team" })).toBeInTheDocument();
  });

  it("an intake referral waits as a person row whose sheet declines only with a reason", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("button", { name: "Intake referral" }));
    // A2-12: an intake names its person, or describes one not yet identified.
    fireEvent.click(screen.getByTestId("ward-community-intake-unidentified"));
    fireEvent.change(screen.getByTestId("ward-community-intake-description"), {
      target: { value: "Adult man, about 30, at the drop-in centre" },
    });
    for (const id of [
      "ward-community-intake-age-band",
      "ward-community-intake-home-region",
      "ward-community-intake-urgency",
      "ward-community-intake-origin-site",
    ]) {
      const select = screen.getByTestId(id);
      fireEvent.change(select, { target: { value: firstOption(select) } });
    }
    fireEvent.click(screen.getByTestId("ward-community-intake-submit"));
    // The page opened on the first list with someone in it; the new referral waits on Waiting.
    fireEvent.click(screen.getByRole("radio", { name: /^Waiting/u }));

    const list = screen.getByTestId("ward-community-phone-list-waiting");
    const row = within(list).getAllByRole("button")[0]!;
    fireEvent.click(row);
    const sheet = screen.getByTestId("ward-community-phone-referral");
    expect(within(sheet).getByRole("button", { name: "Accept referral" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Decline" }));
    const decline = () => within(sheet).getByRole("button", { name: /Decline referral/ });
    expect(decline()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(sheet).getAllByRole("radio")[0]!);
    expect(decline()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(decline());
    expect(screen.getByTestId("toast-region")).toHaveTextContent("Referral declined");
    expect(within(screen.getByTestId("ward-community-phone-list-waiting")).queryAllByRole("listitem")).toHaveLength(0);
  });
});

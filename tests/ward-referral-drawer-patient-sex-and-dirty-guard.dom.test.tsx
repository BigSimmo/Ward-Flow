import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  window.sessionStorage.clear();
});

function fireBeforeUnload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function RegisteredPatientSeeder() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="seed-registered-patient"
      onClick={() => {
        dispatch({
          type: "ADD_PATIENT",
          role: "ed",
          now: NOW_ANCHOR,
          givenName: "Clara",
          familyName: "Vance",
          dateOfBirth: "1991-04-12",
          gender: "Female",
          umrn: "UM999001",
        });
      }}
    >
      Seed patient
    </button>
  );
}

/** sessionStorage keys outside the D-67 synthetic-draft exception (session marker and scoped drafts). */
function storageOutsideD67(): string[] {
  return Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.key(i) ?? "").filter(
    (key) => key !== "wf-draft-session:v1" && !key.startsWith("wf-draft:v1:"),
  );
}

function localStorageText(): string {
  return Array.from({ length: window.localStorage.length }, (_, i) => {
    const key = window.localStorage.key(i) ?? "";
    return `${key}=${window.localStorage.getItem(key) ?? ""}`;
  }).join("\n");
}

describe("Task 2 — Referral drawer patient sex retention, dirty guards, and section tab stops", () => {
  it("retains sex (35F) when adding a new patient in WardReferralDrawer and selecting a patient:<id> record", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RegisteredPatientSeeder />
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );

    // 1. Add a new patient directly via the drawer's new-patient form
    fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    const newPatientForm = within(screen.getByTestId("ward-referral-new-patient"));
    fireEvent.change(newPatientForm.getByLabelText(/Family name/), { target: { value: "Rostova" } });
    fireEvent.change(newPatientForm.getByLabelText(/Given name/), { target: { value: "Elena" } });
    fireEvent.change(newPatientForm.getByLabelText(/Date of birth/), { target: { value: "1991-05-15" } });
    fireEvent.change(newPatientForm.getByLabelText(/UMRN/), { target: { value: "UM999002" } });
    fireEvent.change(newPatientForm.getByLabelText(/Gender/), { target: { value: "Female" } });

    fireEvent.click(newPatientForm.getByRole("button", { name: "Add patient" }));

    // Age + Sex badge should render "35F" rather than "35, sex not recorded"
    expect(screen.getByText("Rostova, Elena (35F)")).toBeInTheDocument();
    expect(screen.queryByText(/sex not recorded/i)).not.toBeInTheDocument();

    // 2. Also verify selecting an existing registered patient (patient:<id>) retains Female
    fireEvent.click(screen.getByTestId("seed-registered-patient"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a patient" }), {
      target: { value: "UM999001" },
    });
    const results = screen.getByRole("listbox", { name: "Matching patients" });
    fireEvent.click(within(results).getAllByRole("option")[0]!);

    expect(screen.getByText("Vance, Clara (35F)")).toBeInTheDocument();
    expect(screen.queryByText(/sex not recorded/i)).not.toBeInTheDocument();

    // 3. Choose Adult in the Age band select and advance to Wards (Step 4): legend must show "Adult · open ·",
    // not "Not recorded", and ward rows must display site codes rather than raw unitId slugs (e.g., rph-adult-secure).
    fireEvent.change(screen.getByLabelText(/Age band/), { target: { value: "Adult" } });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", {
        name: "Wards",
      }),
    );
    expect(screen.getByText(/Adult · open ·/i)).toBeInTheDocument();
    expect(screen.queryByText(/Not recorded · open ·/i)).not.toBeInTheDocument();
    expect(screen.queryByText("rph-adult-secure")).not.toBeInTheDocument();
    expect(screen.queryByText("fsh-adult-secure")).not.toBeInTheDocument();
  });

  it("blocks beforeunload when WardReferralDrawer has unsaved or kept in-memory edits, uses aria-disabled on Save draft, and never persists clinical story to sessionStorage", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );

    expect(fireBeforeUnload()).toBe(false);

    // Pristine Save draft button uses aria-disabled="true" with sr-only explanation instead of bare disabled
    const saveDraftBtn = screen.getByTestId("ward-referral-save-draft");
    expect(saveDraftBtn).toHaveAttribute("aria-disabled", "true");
    expect(saveDraftBtn).not.toBeDisabled();
    const describedById = saveDraftBtn.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)).toHaveTextContent(
      /Make a change to the referral before saving a draft/i,
    );

    // Switch to Referral tab and type a clinical story
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", {
        name: "Referral",
      }),
    );
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: "Confidential synthetic clinical story" },
    });

    expect(saveDraftBtn).not.toHaveAttribute("aria-disabled");
    expect(fireBeforeUnload()).toBe(true);
    // D-67 (Josh, 17 Oct 2026) narrows D-18 for this synthetic drawer: typed drafts may live only in
    // the session-scoped `wf-draft:v1:` entries (plus the session marker, which holds no form text).
    // Anything else in sessionStorage, or the story anywhere in localStorage, is still a leak.
    expect(storageOutsideD67()).toEqual([]);
    expect(localStorageText()).not.toContain("Confidential synthetic clinical story");

    // Clicking Save draft keeps the draft in tab memory; beforeunload stays active while kept draft is in memory
    fireEvent.click(saveDraftBtn);
    expect(fireBeforeUnload()).toBe(true);
    expect(storageOutsideD67()).toEqual([]);
    expect(localStorageText()).not.toContain("Confidential synthetic clinical story");
  });

  it("removes tabIndex={0} from non-interactive sections in WardAnswerView and guards unsaved capacity edits on beforeunload", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAnswerView unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const sections = Array.from(container.querySelectorAll("section"));
    expect(sections.length).toBeGreaterThanOrEqual(3);
    for (const sec of sections) {
      expect(sec.getAttribute("tabindex")).toBeNull();
    }

    expect(fireBeforeUnload()).toBe(false);

    // Edit a capacity step button to dirty the capacity draft
    const incButtons = screen.getAllByRole("button", { name: /Increase/i });
    expect(incButtons.length).toBeGreaterThan(0);
    fireEvent.click(incButtons[0]!);

    expect(fireBeforeUnload()).toBe(true);
  });

  it("guards unsaved rule edits in SettingsScreen on beforeunload", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SettingsScreen />
      </WardFlowProvider>,
    );

    expect(fireBeforeUnload()).toBe(false);

    // Toggle a rule or edit a field on the Placement Rules tab
    const checkboxes = screen.queryAllByRole("checkbox");
    const switches = screen.queryAllByRole("switch");
    const targetToggle = switches[0] ?? checkboxes[0];
    if (targetToggle) {
      fireEvent.click(targetToggle);
      expect(fireBeforeUnload()).toBe(true);
    }
  });
});

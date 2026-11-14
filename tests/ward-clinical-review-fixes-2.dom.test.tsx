import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardClinicalTvView } from "@/components/ward-management/bed-meeting/tv-clinical-views";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardObsLeaveTvView } from "@/components/ward-management/bed-meeting/tv-function-views";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { TriageScreen } from "@/components/ward-management/triage/triage-risk-form";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NO_INTERVAL_ERROR } from "@/components/ward-management/ward-observation";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardAcceptedReferralPlacementForm } from "@/components/ward-management/ward/ward-accepted-referral-placement-form";
import { ToastProvider } from "@/components/wf";

import {
  chooseEdChoice,
  EdInboxReferralFixture,
  markNotYetIdentified,
  openRaiseIntoMovementForm,
} from "./helpers/ed-raise-into-movement";
import { SIGNED_RECORD_WORDS } from "./helpers/triage-example";

// The independent clinical review's R1 (placement form), R10 (signer after signing) and question 8
// (TV label), drawn on screen. Synthetic data only.

const TRIAGE_PATH = "/ward-flow/triage/new";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/triage/new",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// R10: the form's checks are not under test here, so every one reads done and signing sends a fixed,
// valid set of codes for the seed person.
vi.mock("@/components/ward-management/triage/triage-risk-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/triage/triage-risk-state")>();
  return {
    ...actual,
    requirements: () => [{ section: "rev", label: "Synthetic check", ok: true, blocks: true }],
    triageSignedFields: (state: { person: { id: string } }) => ({
      patientId: state.person.id,
      urgency: "C",
      outcome: "Accepted",
      legal: "cto",
      review: "72h",
      riskFlags: [],
      problems: [],
      actions: [],
      venue: "ed",
      referralType: "self",
    }),
  };
});

afterEach(cleanup);

function choose(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.input(field);
}

function PlacementWorkspace({ dispatch }: { dispatch: WardCommandDispatch }) {
  const value = useWardFlow();
  const referral: Referral = {
    ...value.referrals[0]!,
    id: "synthetic-review-r1-placement",
    source: "community",
    ageBand: "Adult",
    intake: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
    ],
  };
  return (
    <WardFlowOverride
      value={{
        ...value,
        dispatch,
        referrals: [referral],
        wardReferralInbox: (id) => wardReferralInboxEntries([referral], id),
      }}
    >
      <WardAcceptedReferralPlacementForm unitId="scgh-adult-open" onStarted={() => {}} onMessage={() => {}} />
    </WardFlowOverride>
  );
}

describe("R1: the accepted-referral placement form starts with no interval (D-187 item 19)", () => {
  it("shows a blank interval, refuses Intermittent without one, then sends the chosen one", async () => {
    const dispatch = vi.fn<WardCommandDispatch>(async () => ({ commandId: "synthetic", status: "accepted" }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PlacementWorkspace dispatch={dispatch} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    choose("Legal status", "Voluntary");
    choose("Legal form", "none");
    choose("Observation level", "intermittent");
    const interval = screen.getByTestId("ward-accepted-placement-interval");
    expect(interval).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose how often to check" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and start placement" }));
    expect(screen.getByTestId("ward-accepted-placement-interval-error")).toHaveTextContent(NO_INTERVAL_ERROR);
    expect(dispatch).not.toHaveBeenCalled();

    choose("Check every", "30");
    expect(screen.queryByTestId("ward-accepted-placement-interval-error")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm and start placement" }));
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(dispatch.mock.calls[0]);
    expect(sent).toContain('"level":"intermittent"');
    expect(sent).toContain('"intervalMinutes":30');
  });
});

describe("R1: the ED raise sends an interval only for Intermittent (D-187 item 19)", () => {
  function Newest() {
    const { movements } = useWardFlow();
    const newest = movements.at(-1)!;
    return <output data-testid="newest-movement">{`${movements.length}|${JSON.stringify(newest.observation)}`}</output>;
  }

  function raiseWith(observation: string, interval?: string) {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <EdInboxReferralFixture edId="jhc-ed" />
          <EdScreen edId="jhc-ed" />
          <Newest />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const before = Number(screen.getByTestId("newest-movement").textContent!.split("|")[0]);
    openRaiseIntoMovementForm();
    markNotYetIdentified();
    chooseEdChoice("ward-ed-referral-cohort", "Adult");
    chooseEdChoice("ward-ed-referral-security", "Open");
    chooseEdChoice("ward-ed-referral-sex", "Female");
    chooseEdChoice("ward-ed-referral-gender", "Female");
    chooseEdChoice("ward-ed-referral-legal-status", "Voluntary");
    // An interval chosen while Intermittent, then perhaps another level chosen after it.
    chooseEdChoice("ward-ed-referral-observation", "intermittent");
    if (interval !== undefined) chooseEdChoice("ward-ed-referral-observation-interval", interval);
    chooseEdChoice("ward-ed-referral-observation", observation);
    fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const [count, sent] = screen.getByTestId("newest-movement").textContent!.split("|");
    return { raised: Number(count) === before + 1, observation: JSON.parse(sent!) as Record<string, unknown> };
  }

  it("sends the chosen interval with Intermittent", () => {
    const { raised, observation } = raiseWith("intermittent", "30");
    expect(raised).toBe(true);
    expect(observation).toMatchObject({ level: "intermittent", intervalMinutes: 30 });
  });

  it("sends no interval for another level, even after one was chosen", () => {
    const { raised, observation } = raiseWith("general", "30");
    expect(raised).toBe(true);
    expect(observation).toMatchObject({ level: "general", intervalMinutes: null });
  });

  it("raises nothing for Intermittent with no interval chosen", () => {
    const { raised } = raiseWith("intermittent");
    expect(raised).toBe(false);
    expect(screen.getByTestId("ward-ed-referral-missing")).toBeInTheDocument();
  });
});

describe("R10: a signed triage keeps naming the desk that signed it (A9-29)", () => {
  afterEach(() => act(() => setDeskRole("coordinator", "")));

  it("does not rename the signer when another desk is previewed with the form open", async () => {
    const patientId = seedWardFlowState().patients[0]!.id;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <TriageScreen patientId={patientId} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    // D-204: the signed tag names the desk, not its sample persona.
    const signer = WARD_FLOW_ROLE_LABELS.coordinator;
    const signAndSend = screen.getAllByRole("button", { name: "Sign and send" })[0]!;
    expect(signAndSend).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(signAndSend);
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Sign" }));
    });
    const tag = await screen.findByTestId("triage-signed-tag");
    expect(tag).toHaveTextContent(`by ${signer}`);

    act(() => setDeskRole("ed", TRIAGE_PATH));
    expect(WARD_FLOW_ROLE_LABELS.ed).not.toBe(signer);
    expect(screen.getByTestId("triage-signed-tag")).toHaveTextContent(`by ${signer}`);
    expect(screen.getByTestId("triage-signed-tag")).not.toHaveTextContent(WARD_FLOW_ROLE_LABELS.ed);
    expect(screen.getByTestId("triage-signed-tag")).not.toHaveTextContent(DESK_PERSONAS.coordinator.name);
  });
});

describe("D-187 TW-198 and D-186 Q14: signing says one entry and names everything it saves", () => {
  it("words the sign dialog as one entry, and the signed line names every saved field", async () => {
    const patientId = seedWardFlowState().patients[0]!.id;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <TriageScreen patientId={patientId} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Sign and send" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Signing records one entry, which prints as SMHMR900 and SMHMR905. Check what you chose.",
    );
    expect(dialog).not.toHaveTextContent("Signing creates both records");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Sign" }));
    });
    const line = await screen.findByTestId("triage-signed-record-line");
    expect(line).toHaveTextContent(
      "Signed to the patient record as codes: urgency, outcome, legal status, review, the risk flags marked present, problems, actions, venue and referral type, with when it was signed and by which desk.",
    );
    const words = (line.textContent ?? "").replace(/\s+/gu, " ").toLowerCase();
    for (const field of Object.values(SIGNED_RECORD_WORDS)) expect(words, field).toContain(field);
    expect(words).not.toContain("review and risk flags only");
  });
});

describe("Question 8: the State TV labels its observation figures as a sample (D-189 item 2)", () => {
  it("labels the on constant obs figure on the ward clinical board", () => {
    render(<WardClinicalTvView rows={[]} footer={null} />);
    expect(screen.getByTestId("tv-summary-note")).toHaveTextContent(SAMPLE_OBSERVATION_MIX_LABEL);
    expect(screen.getByTestId("tv-summary-note").closest("li")).toHaveTextContent("on constant obs");
  });

  it("labels the Constant observation lane on the obs board", () => {
    render(<WardObsLeaveTvView rows={[]} footer={null} />);
    const lane = screen.getByRole("region", { name: /Constant observation/u });
    expect(lane).toHaveTextContent(SAMPLE_OBSERVATION_MIX_LABEL);
  });
});

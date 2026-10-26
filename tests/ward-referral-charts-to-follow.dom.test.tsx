import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  DocumentationPanel,
  documentationError,
  documentationProblems,
  EMPTY_DOCUMENTATION,
  type DocumentationDraft,
} from "@/components/ward-management/referrals/referral-flow-panels";
import { ReferralDocumentLinks, chartsCountText } from "@/components/ward-management/referrals/referral-document-links";
import { documentationNeeded } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import {
  referralIntakeError,
  type ReferralChart,
  type ReferralIntakeDetails,
} from "@/components/ward-management/referrals/referral-submission";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardReferralDetail } from "@/components/ward-management/ward/ward-referral-detail";
import { referralFit } from "@/components/ward-management/ward/ward-referral-fit";

// A27 (Josh, 26 Oct 2026): the medication and observation charts may be marked "to follow".
// Synthetic data only.

const chart = (kind: ReferralChart["kind"]): ReferralChart => ({
  kind,
  name: `${kind}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 4,
  base64: "JVBERg==",
});

const intake: ReferralIntakeDetails = {
  catchment: { teamName: "Inner City Clinic", confirmed: true },
  reasonForReferral: "Synthetic referral for assessment",
  legalStatus: "Voluntary",
  riskFlags: [],
  medicalClearance: { cleared: true },
  triageAndRampCompleted: true,
  additionalDocuments: false,
  charts: [chart("observation")],
  chartsToFollow: ["medication"],
  referrer: { name: "Demo Sender", phone: "0400000000", email: "demo@example.com", role: "Nurse", location: "ED" },
};

const answered: DocumentationDraft = {
  ...EMPTY_DOCUMENTATION,
  medical: "yes",
  triage: "yes",
  additional: "no",
  charts: [chart("observation")],
};

describe("charts to follow", () => {
  it("accepts a required chart marked to follow instead of attached", () => {
    expect(referralIntakeError(intake)).toBeNull();
    expect(referralIntakeError({ ...intake, chartsToFollow: ["medication", "observation"], charts: [] })).toBeNull();
  });

  it("still refuses a required chart that is neither attached nor to follow", () => {
    expect(referralIntakeError({ ...intake, chartsToFollow: undefined })).toMatch(/or mark them to follow/u);
  });

  it("refuses a chart that is both attached and to follow, an unknown kind, a repeat or an empty list", () => {
    for (const chartsToFollow of [["observation"], ["other"], ["medication", "medication"], []]) {
      expect(
        referralIntakeError({ ...intake, chartsToFollow: chartsToFollow as ReferralIntakeDetails["chartsToFollow"] }),
      ).not.toBeNull();
    }
  });

  it("counts a chart marked to follow as answered on the Documents step", () => {
    expect(documentationError(answered)).toMatch(/or mark them to follow/u);
    expect(documentationProblems(answered, "doc").map((item) => item.text)).toEqual([
      "Attach the medication chart or mark it to follow",
    ]);
    const marked = { ...answered, toFollow: ["medication" as const] };
    expect(documentationError(marked)).toBeNull();
    expect(documentationNeeded(marked)).toBe(0);
  });

  it("offers To follow on the two required charts, and attaching a file clears it", () => {
    let latest: DocumentationDraft = answered;
    function Harness() {
      const [draft, setDraft] = useState<DocumentationDraft>(answered);
      latest = draft;
      return <DocumentationPanel draft={draft} onChange={setDraft} idBase="doc" />;
    }
    render(<Harness />);
    // Observation is attached, so only the medication chart offers To follow.
    const toFollow = screen.getAllByRole("checkbox", { name: "To follow" });
    expect(toFollow).toHaveLength(1);
    fireEvent.click(toFollow[0]!);
    expect(latest.toFollow).toEqual(["medication"]);
    expect(screen.getByText("To follow. The referral says it is not attached yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "To follow" }));
    expect(latest.toFollow).toEqual([]);
  });

  it("says which charts are to follow wherever the referral is read", () => {
    render(<ReferralDocumentLinks charts={[chart("observation")]} toFollow={["medication"]} />);
    expect(screen.getByText("Medication chart · to follow, not attached yet")).toBeInTheDocument();
    expect(chartsCountText(1, 1)).toBe("1 attached, 1 to follow");
    expect(chartsCountText(2, 0)).toBe("2 attached");
  });
});

describe("charts to follow on the receiving ward's referral detail", () => {
  it("names the chart still to follow beside the attached one (Codex review on #845)", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements[0]!;
    const unit = seed.units[0]!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDetail
          movement={movement}
          now={NOW_ANCHOR}
          identity={resolveSubjectPatient(movement, seed)}
          intake={intake}
          fit={referralFit([], unit, NOW_ANCHOR)}
        />
      </WardFlowProvider>,
    );
    const documents = screen.getByTestId("ward-referral-documents");
    expect(documents).toHaveTextContent("observation.pdf");
    expect(documents).toHaveTextContent("Medication chart");
    expect(documents).toHaveTextContent("To follow, not attached yet.");
  });
});

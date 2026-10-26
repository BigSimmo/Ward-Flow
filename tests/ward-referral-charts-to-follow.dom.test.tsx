import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("names each required chart's To follow checkbox independently", () => {
    render(<DocumentationPanel draft={EMPTY_DOCUMENTATION} onChange={() => {}} idBase="doc" />);
    expect(screen.getByRole("checkbox", { name: "Medication chart to follow" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Observation chart to follow" })).not.toBeChecked();
  });

  it("clears To follow on upload, replaces one chart and does not restore the flag on removal", async () => {
    let latest: DocumentationDraft = answered;
    function Harness() {
      const [draft, setDraft] = useState<DocumentationDraft>(answered);
      latest = draft;
      return <DocumentationPanel draft={draft} onChange={setDraft} idBase="doc" />;
    }
    render(<Harness />);
    // Observation is attached, so only the medication chart offers To follow.
    const toFollow = screen.getAllByRole("checkbox", { name: "Medication chart to follow" });
    expect(toFollow).toHaveLength(1);
    fireEvent.click(toFollow[0]!);
    expect(latest.toFollow).toEqual(["medication"]);
    expect(screen.getByText("To follow. The referral says it is not attached yet.")).toBeInTheDocument();
    const upload = (name: string) => {
      const contents = "%PDF-1.7\nSynthetic chart";
      const file = new File([contents], name, { type: "application/pdf" });
      Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(contents).buffer });
      fireEvent.change(screen.getByLabelText("Medication chart", { selector: 'input[type="file"]' }), {
        target: { files: [file] },
      });
    };
    upload("synthetic-medication.pdf");
    await waitFor(() =>
      expect(latest.charts.find((file) => file.kind === "medication")?.name).toBe("synthetic-medication.pdf"),
    );
    expect(latest.toFollow).toEqual([]);
    expect(screen.queryByRole("checkbox", { name: "Medication chart to follow" })).not.toBeInTheDocument();
    upload("synthetic-replacement.pdf");
    await waitFor(() =>
      expect(latest.charts.find((file) => file.kind === "medication")?.name).toBe("synthetic-replacement.pdf"),
    );
    expect(latest.charts.filter((file) => file.kind === "medication")).toHaveLength(1);
    expect(latest.charts.find((file) => file.kind === "observation")).toEqual(chart("observation"));
    fireEvent.click(screen.getByRole("button", { name: "Remove medication chart" }));
    expect(screen.getByRole("checkbox", { name: "Medication chart to follow" })).not.toBeChecked();
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

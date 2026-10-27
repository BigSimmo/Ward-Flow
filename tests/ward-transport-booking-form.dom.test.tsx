import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
  etaPresetAnswers,
  transportBookingSubmission,
  transportBookingTestId,
  type TransportBookingSubmission,
} from "@/components/ward-management/transport/transport-booking-form";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Movement, TransportExceptionReason } from "@/components/ward-management/ward-model";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";

/*
 * A34 (26 Oct 2026): one transport booking form for the ED, community, patient page and transit
 * deck. These pin the rules every screen now shares, on synthetic records only.
 */

afterEach(cleanup);

const NOW = 3 * MINUTES_PER_DAY + 10 * 60 + 42;
const INVOLUNTARY: Pick<Movement, "legalStatus" | "legalForm" | "pullExpiresAt"> = {
  legalStatus: "Involuntary inpatient",
  legalForm: undefined,
  pullExpiresAt: NOW + 60,
};

function Harness({
  record,
  onSubmit,
  now = NOW,
}: {
  record: Pick<Movement, "legalStatus" | "legalForm" | "pullExpiresAt"> | undefined;
  onSubmit: (booking: TransportBookingSubmission) => void;
  now?: number;
}) {
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [reason, setReason] = useState<TransportExceptionReason | "">("");
  return (
    <TransportBookingForm
      answers={answers}
      onAnswers={setAnswers}
      legalReason={reason}
      onLegalReason={setReason}
      record={record}
      patientName="Synthetic Person"
      now={now}
      testIds={{ prefix: "t", suffix: "WF-1" }}
      onSubmit={onSubmit}
    />
  );
}

const id = (part: Parameters<typeof transportBookingTestId>[1], option?: string) =>
  transportBookingTestId({ prefix: "t", suffix: "WF-1" }, part, option);

function answerTheCall() {
  fireEvent.change(screen.getByTestId(id("provider")), { target: { value: "Ambulance (St John)" } });
  fireEvent.click(screen.getByTestId(id("escort", "no")));
  fireEvent.change(screen.getByTestId(id("cad")), { target: { value: "CAD-48213" } });
  fireEvent.change(screen.getByTestId(id("time")), { target: { value: "11:15" } });
}

describe("the one transport booking form", () => {
  it("fills legal status from Legal now, and nothing else", () => {
    render(<Harness record={INVOLUNTARY} onSubmit={vi.fn()} />);
    expect(screen.getByTestId(id("legal", "involuntary"))).toBeChecked();
    expect(screen.getByTestId(id("escort", "yes"))).not.toBeChecked();
    expect(screen.getByTestId(id("escort", "no"))).not.toBeChecked();
    expect(screen.getByTestId(id("provider"))).toHaveValue("");
    expect(screen.getByTestId(id("cad"))).toHaveValue("");
    expect(screen.getByTestId(id("time"))).toHaveValue("");
    expect(screen.getByTestId(id("left"))).toHaveTextContent(
      "4 answers left: provider, CAD number, estimated time, escort answer",
    );
  });

  it("leaves legal status blank when the record holds none", () => {
    // Older records can arrive without a status, which is what `legalNowTransportStatus` guards.
    const noStatus = { legalForm: undefined } as unknown as Pick<Movement, "legalStatus" | "legalForm">;
    render(<Harness record={noStatus} onSubmit={vi.fn()} />);
    expect(screen.getByTestId(id("legal", "involuntary"))).not.toBeChecked();
    expect(screen.getByTestId(id("legal", "voluntary"))).not.toBeChecked();
    expect(screen.getByTestId(id("left"))).toHaveTextContent("legal status");
  });

  it("books once every answer is in, with exactly the fields BOOK_TRANSPORT takes", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).not.toHaveBeenCalled();
    answerTheCall();
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledWith({
      provider: "Ambulance (St John)",
      escortRequired: false,
      cadNumber: "CAD-48213",
      transportLegalStatus: "involuntary",
      estimatedAt: 3 * MINUTES_PER_DAY + 11 * 60 + 15,
    });
  });

  it("asks why when the status differs from Legal now, and records the reason as the exception", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    answerTheCall();
    fireEvent.click(screen.getByTestId(id("legal", "voluntary")));
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId(id("left"))).toHaveTextContent("1 answer left: reason it differs");
    expect(screen.getByTestId(id("legal-reason"))).toHaveFocus();
    fireEvent.change(screen.getByTestId(id("legal-reason")), { target: { value: "paper_sighted" } });
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        transportLegalStatus: "voluntary",
        exception: { gaps: ["legal_status_differs"], reason: "paper_sighted" },
      }),
    );
  });

  it("refuses a placeholder CAD number beside the field", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    answerTheCall();
    fireEvent.change(screen.getByTestId(id("cad")), { target: { value: "TBC" } });
    expect(screen.getByTestId(id("cad-problem"))).toHaveTextContent(/placeholder/);
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit on Enter from inside a field", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    answerTheCall();
    fireEvent.keyDown(screen.getByTestId(id("cad")), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId(id("cad")).closest("form")).toBeNull();
  });

  it("quick times fill the time and the day, and warn when the bed hold ends first", () => {
    render(<Harness record={INVOLUNTARY} onSubmit={vi.fn()} />);
    fireEvent.click(within(screen.getByTestId(id("presets"))).getByRole("button", { name: "+1h" }));
    expect(screen.getByTestId(id("time"))).toHaveValue("11:42");
    expect(screen.getByTestId(id("day", "today"))).toBeChecked();
    expect(screen.queryByTestId(id("hold"))).toBeNull();
    fireEvent.change(screen.getByTestId(id("time")), { target: { value: "12:30" } });
    expect(screen.getByTestId(id("hold"))).toHaveTextContent("Arrives after the pull time limit ends at 11:42");
  });

  it("a quick time past midnight is tomorrow", () => {
    const lateNow = 3 * MINUTES_PER_DAY + 23 * 60 + 50;
    expect(etaPresetAnswers(lateNow, 30)).toEqual({ estimatedTime: "00:20", estimatedDay: "tomorrow" });
    expect(etaPresetAnswers(lateNow, 0)).toEqual({ estimatedTime: "23:50", estimatedDay: "today" });
  });

  it("the submission rule matches the form", () => {
    const answers: TransportBookingAnswers = {
      provider: "Patient transport service",
      escortRequired: true,
      cadNumber: " CAD-1 ",
      transportLegalStatus: "voluntary",
      estimatedTime: "0930",
      estimatedDay: "tomorrow",
    };
    expect(transportBookingSubmission(answers, "", INVOLUNTARY, NOW)).toBeUndefined();
    expect(transportBookingSubmission(answers, "urgent_to_follow", INVOLUNTARY, NOW)).toMatchObject({
      cadNumber: "CAD-1",
      estimatedAt: 4 * MINUTES_PER_DAY + 9 * 60 + 30,
      exception: { reason: "urgent_to_follow" },
    });
  });

  it("keeps the CAD box for a ward escort or a family member, but books without one", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId(id("provider")), { target: { value: "Ward escort" } });
    expect(screen.getByTestId(id("cad"))).toHaveValue("");
    fireEvent.click(screen.getByTestId(id("escort", "yes")));
    fireEvent.change(screen.getByTestId(id("time")), { target: { value: "11:15" } });
    expect(screen.queryByTestId(id("left"))).toBeNull();
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ provider: "Ward escort", cadNumber: "" }));
  });

  it("keeps a CAD number typed for a family member, and still refuses a placeholder", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId(id("provider")), { target: { value: "Family or carer" } });
    fireEvent.click(screen.getByTestId(id("escort", "no")));
    fireEvent.change(screen.getByTestId(id("time")), { target: { value: "11:15" } });
    fireEvent.change(screen.getByTestId(id("cad")), { target: { value: "TBC" } });
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId(id("cad")), { target: { value: " CAD-77 " } });
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "Family or carer", cadNumber: "CAD-77" }),
    );
  });

  it("Save pressed early moves to the first answer still to give", () => {
    const onSubmit = vi.fn();
    render(<Harness record={INVOLUNTARY} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId(id("provider"))).toHaveFocus();
  });
});

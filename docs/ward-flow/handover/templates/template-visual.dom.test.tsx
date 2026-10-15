import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HorizonGantt } from "./template-component";
import { HorizonEventItem } from "./template-derivations";

const SAMPLE_EVENTS: HorizonEventItem[] = [
  {
    id: "mov-1",
    patientId: "MRN-4012",
    patientName: "C. Higgins",
    wardId: "ward-4a",
    wardName: "FSH · Ward 4A",
    type: "admit",
    startHour: 2,
    durationHours: 14,
    statusLabel: "Admit Scheduled",
    statutoryForm: "Form 4A Transport Order",
    escortRequired: "Mental Health Transport Service",
  },
  {
    id: "mov-2",
    patientId: "MRN-8821",
    patientName: "S. Vance",
    wardId: "ward-2k",
    wardName: "RPH · Ward 2K",
    type: "leave",
    startHour: 10,
    durationHours: 6,
    statusLabel: "Leave Return",
    statutoryForm: "Form 5A Involuntary",
  },
  {
    id: "mov-3",
    patientId: "MRN-1094",
    patientName: "A. Kumar",
    wardId: "ward-w3",
    wardName: "Graylands · W3",
    type: "discharge",
    startHour: 18,
    durationHours: 2,
    statusLabel: "Discharge Ready",
  },
];

describe("HorizonGantt Component Visual & Interactive Integrity Suite", () => {
  it("renders all distinct ward lanes with their expected headers", () => {
    render(<HorizonGantt events={SAMPLE_EVENTS} />);

    const region = screen.getByRole("region", { name: "Movement Horizon" });
    expect(region).toBeInTheDocument();

    expect(within(region).getByTitle("FSH · Ward 4A")).toBeInTheDocument();
    expect(within(region).getByTitle("RPH · Ward 2K")).toBeInTheDocument();
    expect(within(region).getByTitle("Graylands · W3")).toBeInTheDocument();
  });

  it("renders zoom controls with 48h active and allows switching to 12h and 24h", () => {
    render(<HorizonGantt events={SAMPLE_EVENTS} defaultZoomHours={48} />);

    const btn48 = screen.getByRole("button", { name: "48h" });
    const btn24 = screen.getByRole("button", { name: "24h" });
    const btn12 = screen.getByRole("button", { name: "12h" });

    expect(btn48).toHaveAttribute("aria-pressed", "true");
    expect(btn24).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(btn24);
    expect(btn24).toHaveAttribute("aria-pressed", "true");
    expect(btn48).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(btn12);
    expect(btn12).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the time scrubber with accessible slider attributes and updates on input", () => {
    render(<HorizonGantt events={SAMPLE_EVENTS} defaultZoomHours={24} />);

    const scrubber = screen.getByLabelText("Timeline scrubber") as HTMLInputElement;
    expect(scrubber).toBeInTheDocument();
    expect(scrubber.min).toBe("0");
    expect(scrubber.max).toBe("24");

    fireEvent.change(scrubber, { target: { value: "6" } });
    expect(scrubber.value).toBe("6");
    expect(screen.getByText("T+6h")).toBeInTheDocument();
  });

  it("opens the detail drawer when an event bar is clicked and traps focus", () => {
    render(<HorizonGantt events={SAMPLE_EVENTS} />);

    const eventBar = screen.getByRole("button", { name: /MRN-4012/i });
    fireEvent.click(eventBar);

    const drawer = screen.getByRole("dialog", { name: "Movement Details" });
    expect(drawer).toBeInTheDocument();

    expect(within(drawer).getByText("C. Higgins")).toBeInTheDocument();
    expect(within(drawer).getByText(/Form 4A Transport Order/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/Mental Health Transport Service/i)).toBeInTheDocument();
  });

  it("closes the detail drawer when pressing the Escape key", () => {
    render(<HorizonGantt events={SAMPLE_EVENTS} />);

    const eventBar = screen.getByRole("button", { name: /MRN-4012/i });
    fireEvent.click(eventBar);

    expect(screen.getByRole("dialog", { name: "Movement Details" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Movement Details" })).not.toBeInTheDocument();
  });
});

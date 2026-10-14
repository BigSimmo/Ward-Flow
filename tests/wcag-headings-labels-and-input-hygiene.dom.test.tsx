import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/mockups/ward-flow/ed",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HomeEdPressure } from "@/components/ward-management/coordinator/home-ed-pressure";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { EdPresentation } from "@/components/ward-management/ed/ed-board-controls";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { Field, Textarea, TextInput } from "@/components/wf/form";

function assertSequentialHeadingHierarchy(container: HTMLElement | Document = document) {
  const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(
    (el) => !el.closest("[hidden]"),
  );
  expect(headings.length).toBeGreaterThan(1);
  const levels = headings.map((el) => Number(el.tagName.slice(1)));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i += 1) {
    const jump = levels[i]! - levels[i - 1]!;
    expect(
      jump,
      `Heading level jumped from h${levels[i - 1]} ("${headings[i - 1]?.textContent?.trim()}") to h${levels[i]} ("${headings[i]?.textContent?.trim()}")`,
    ).toBeLessThanOrEqual(1);
  }
}

describe("WCAG 2.5.3 labels, sequential heading hierarchy, and clinical input hygiene", () => {
  it("includes visible site code, waiting count, wait phrase, and deadline phrase inside HomeEdPressure button accessible names (WCAG 2.5.3)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HomeEdPressure
          now={NOW_ANCHOR}
          movements={wardMovements}
          selectedEdId={undefined}
          onSelectEd={() => {}}
          service={null}
        />
      </WardFlowProvider>,
    );

    const buttons = screen.getAllByTestId(/^ward-ed-/);
    expect(buttons).toHaveLength(10);

    for (const button of buttons) {
      const ariaLabel = (button.getAttribute("aria-label") ?? "").toLowerCase();
      const visibleTexts = Array.from(button.querySelectorAll("strong, span"))
        .map((node) => node.textContent?.trim() ?? "")
        .filter(Boolean);
      expect(visibleTexts.length).toBeGreaterThan(0);
      for (const text of visibleTexts) {
        expect(ariaLabel).toContain(text.toLowerCase());
      }
    }
  });

  it("maintains sequential heading hierarchy (h1 -> h2 -> h3) without skipping levels on PatientNowScreen (all tabs), DelaysScreen, EdIndex, and EdScreen", () => {
    const { container: patientContainer, unmount: unmountPatient } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={wardMovements[0]!.patientId} />
      </WardFlowProvider>,
    );
    assertSequentialHeadingHierarchy(patientContainer);
    unmountPatient();

    const { container: movementContainer, unmount: unmountMovement } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-009" />
      </WardFlowProvider>,
    );
    assertSequentialHeadingHierarchy(movementContainer);
    for (const tabName of ["History", "Community", "Details", "Documents"]) {
      const tab = screen.queryByRole("tab", { name: new RegExp(`^${tabName}`, "i") });
      if (tab) {
        fireEvent.click(tab);
        assertSequentialHeadingHierarchy(movementContainer);
      }
    }
    unmountMovement();

    const { container: delaysContainer, unmount: unmountDelays } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    assertSequentialHeadingHierarchy(delaysContainer);
    unmountDelays();

    const { container: edIndexContainer, unmount: unmountEdIndex } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    assertSequentialHeadingHierarchy(edIndexContainer);
    unmountEdIndex();

    const { container: edScreenContainer, unmount: unmountEdScreen } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    assertSequentialHeadingHierarchy(edScreenContainer);
    const transportToggle = screen
      .queryAllByTestId(/^ward-ed-book-transport-toggle-/)
      .find((el) => !el.hasAttribute("aria-disabled"));
    if (transportToggle) {
      fireEvent.click(transportToggle);
      assertSequentialHeadingHierarchy(document);
    }
    unmountEdScreen();
  });

  it("applies role=alert on Field error text and defaults data-gramm=false and spellCheck=false on TextInput, Textarea, and EdPresentation", () => {
    render(
      <div>
        <Field label="UMRN" error="Invalid UMRN">
          <TextInput data-testid="wf-text-input" />
        </Field>
        <Textarea aria-label="Clinical notes" data-testid="wf-textarea" />
        <EdPresentation
          patientName="Bao Davenport"
          value="Initial presentation note"
          onChange={() => {}}
          testId="ed-pres-trigger"
        />
      </div>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid UMRN");

    const textInput = screen.getByTestId("wf-text-input");
    expect(textInput).toHaveAttribute("data-gramm", "false");
    expect(textInput).toHaveAttribute("data-gramm_editor", "false");
    expect(textInput).toHaveAttribute("data-enable-grammarly", "false");
    expect(textInput).toHaveAttribute("spellcheck", "false");

    const textarea = screen.getByTestId("wf-textarea");
    expect(textarea).toHaveAttribute("data-gramm", "false");
    expect(textarea).toHaveAttribute("data-gramm_editor", "false");
    expect(textarea).toHaveAttribute("data-enable-grammarly", "false");
    expect(textarea).toHaveAttribute("spellcheck", "false");

    const edTextarea = document.querySelector("dialog textarea");
    expect(edTextarea).not.toBeNull();
    expect(edTextarea).toHaveAttribute("spellcheck", "false");
    expect(edTextarea).toHaveAttribute("data-gramm", "false");
    expect(edTextarea).toHaveAttribute("data-gramm_editor", "false");
  });
});

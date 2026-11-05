import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Long names and suburbs warn and never block (Josh, 5 Nov 2026): only Mental Health Act 2014 legal
 * and safety fields block. Typing goes on past 100 characters, a plain warning shows, and the record
 * still saves. Synthetic names only.
 */
const LONG_GIVEN = "Testable".repeat(13); // 104 characters
const LONG_SUBURB = "Synthetic Heights ".repeat(6).trim(); // 107 characters

afterEach(() => {
  cleanup();
  router.push.mockClear();
});

describe("Add patient long names and suburbs (warn, never block)", () => {
  it("takes more than 100 characters, warns, and still saves", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <AddPatientForm />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const given = screen.getByLabelText("Given name") as HTMLInputElement;
    const suburb = screen.getByLabelText("Suburb") as HTMLInputElement;
    expect(given).not.toHaveAttribute("maxlength");
    expect(suburb).not.toHaveAttribute("maxlength");
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999998" } });
    fireEvent.change(given, { target: { value: "Testable" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Newcomer" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "01/01/1990" } });
    expect(screen.queryByText(/Long (name|suburb)\. Check it is right\./)).toBeNull();
    const status = screen.getByTestId("ward-add-patient-long-text-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toBeEmptyDOMElement();

    fireEvent.change(given, { target: { value: LONG_GIVEN } });
    fireEvent.change(suburb, { target: { value: LONG_SUBURB } });
    expect(given.value).toHaveLength(104);
    expect(suburb.value).toHaveLength(107);
    expect(screen.getByText("Long name. Check it is right.")).toBeInTheDocument();
    expect(screen.getByText("Long suburb. Check it is right.")).toBeInTheDocument();
    expect(given).toHaveAccessibleDescription(/Long name\. Check it is right\./);
    expect(given).not.toHaveAttribute("aria-invalid");
    expect(status).toHaveTextContent("Long given name. Check it is right. Long suburb. Check it is right.");

    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("toast")).toHaveTextContent(`Newcomer, ${LONG_GIVEN} added, UM999998`);
  });
});

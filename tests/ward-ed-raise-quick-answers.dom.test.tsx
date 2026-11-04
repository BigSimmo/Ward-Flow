import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  EdInboxReferralFixture,
  openRaiseIntoMovementForm,
  chooseEdChoice,
  edChoiceValue,
} from "./helpers/ed-raise-into-movement";

/**
 * H-1019 (RG-PH-01, phone release gate on WebKit, 26 Oct 2026): Security came back blank when it
 * was chosen straight after Cohort. Each select read `event.target.value` inside its functional
 * `setDraft` updater. When an update is already queued, React runs the updater later, after it has
 * put the controlled select back to its old value, so the updater read the old, empty choice. The
 * value is now taken from the event before the update is queued.
 *
 * ⚠️ jsdom does not reproduce the WebKit drop: the behaviour case below passed before the fix too.
 * The source check is the guard that fails if the pattern comes back; the behaviour case proves
 * the form still takes both answers.
 */
describe("ED Ask for a bed form, answered quickly", () => {
  it("keeps both answers when Cohort and Security change before a render", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdInboxReferralFixture edId="jhc-ed" />
        <EdScreen edId="jhc-ed" />
      </WardFlowProvider>,
    );
    openRaiseIntoMovementForm();
    // L31: both are kit segmented controls; pick an answer other than the one the referral filled.
    act(() => {
      chooseEdChoice("ward-ed-referral-cohort", "Older adult");
      chooseEdChoice("ward-ed-referral-security", "Secure");
    });
    expect(edChoiceValue("ward-ed-referral-cohort")).toBe("Older adult");
    expect(edChoiceValue("ward-ed-referral-security")).toBe("Secure");
  });

  it("never reads the event inside a state updater on the ED forms", () => {
    for (const file of [
      "src/components/ward-management/ed/ed-screen-raise-section.tsx",
      "src/components/ward-management/ed/ed-screen-row-forms.tsx",
      "src/components/ward-management/ed/ed-screen-row-facts.tsx",
      "src/components/ward-management/ed/ed-screen-referred.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\(\(current\)\s*=>[^}]*?\b(?:event|e)\.target\.value/su);
    }
  });
});

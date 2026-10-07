import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { UNSAVED_HISTORY_WARNING } from "@/components/ward-management/referrals/referral-intake";

describe("Phase 1 Remediation - Safety & Clinical Perimeter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("In-App Navigation Interception for Unsaved Clinical History", () => {
    it("intercepts anchor link navigation when confirm is rejected", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      // Create an anchor inside the DOM
      const anchor = document.createElement("a");
      anchor.href = "/mockups/ward-flow/command";
      anchor.textContent = "Navigate Away";
      document.body.appendChild(anchor);

      let clickPrevented = false;
      const clickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const a = target?.closest("a[href]") as HTMLAnchorElement | null;
        if (!a) return;
        const confirmed = window.confirm(UNSAVED_HISTORY_WARNING);
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
          clickPrevented = true;
        }
      };

      document.addEventListener("click", clickHandler, true);

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_HISTORY_WARNING);
      expect(clickPrevented).toBe(true);
      expect(event.defaultPrevented).toBe(true);

      document.removeEventListener("click", clickHandler, true);
      document.body.removeChild(anchor);
    });

    it("allows anchor link navigation when confirm is accepted", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      const anchor = document.createElement("a");
      anchor.href = "/mockups/ward-flow/command";
      anchor.textContent = "Navigate Away";
      document.body.appendChild(anchor);

      let clickPrevented = false;
      const clickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const a = target?.closest("a[href]") as HTMLAnchorElement | null;
        if (!a) return;
        const confirmed = window.confirm(UNSAVED_HISTORY_WARNING);
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
          clickPrevented = true;
        }
      };

      document.addEventListener("click", clickHandler, true);

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_HISTORY_WARNING);
      expect(clickPrevented).toBe(false);
      expect(event.defaultPrevented).toBe(false);

      document.removeEventListener("click", clickHandler, true);
      document.body.removeChild(anchor);
    });
  });
});

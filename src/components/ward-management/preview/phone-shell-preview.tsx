import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { WardPhoneShellPreviewFlag } from "./ward-phone-shell-preview";
import type { PhoneShellPreviewPage, WardPreviewOption } from "./ward-preview-routes";

/**
 * Phone shell mockup (device audit, 11 Oct 2026, preview only): a live page, unchanged, inside the
 * shell with the previewed dock, Menu and Create sheet. The shell parts themselves carry the
 * change; this only names the page and switches the option on.
 */
export function PhoneShellPreview({ page, option }: { page: PhoneShellPreviewPage; option: WardPreviewOption }) {
  return (
    <>
      <WardPhoneShellPreviewFlag option={option} />
      {page === "ward" ? (
        <WardScreen unitId="rph-adult-secure" />
      ) : page === "officer" ? (
        <OfficerScreen />
      ) : (
        <CoordinatorScreen />
      )}
    </>
  );
}

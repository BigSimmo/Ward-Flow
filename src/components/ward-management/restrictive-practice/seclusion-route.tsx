"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { HeldDeskLoading } from "@/app/ward-flow/loading-status";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { presetWardBarPageTitle } from "../shell/ward-bar-page-tools";
import { ROLE_SCREENS } from "../ward-role-access";
import { SeclusionScreen } from "./seclusion-screen";

/** FS3: where seclusion and restraint in use now is recorded for a desk that opens Forms. */
const SECLUSION_IN_FORMS_PATH = "/ward-flow/legal-forms";
const SECLUSION_IN_FORMS_HREF = `${SECLUSION_IN_FORMS_PATH}?view=seclusion`;

/**
 * FS3 (Josh, 3 Nov 2026, Q29): Seclusion left the sidebar and its live view moved into Forms. Old
 * links and bookmarks still land here, so a desk that opens Forms is sent to that view. A site bed
 * manager has no Forms page (D-80), so it keeps this page as it was.
 */
export function SeclusionRoute() {
  const access = useEffectiveWardAccess();
  const router = useRouter();
  const opensForms = ROLE_SCREENS[access.role]["legal-forms"] !== undefined;
  const seesSeclusionInForms = ROLE_SCREENS[access.role].seclusion !== undefined;
  useEffect(() => {
    if (!opensForms) return;
    // The bar keeps "Seclusion" through the hand-over, as Forms names its Seclusion view.
    if (seesSeclusionInForms) presetWardBarPageTitle(SECLUSION_IN_FORMS_PATH, "Seclusion");
    router.replace(SECLUSION_IN_FORMS_HREF);
  }, [opensForms, seesSeclusionInForms, router]);
  // Phone load audit (10 Nov 2026): the shell's placeholder while Forms loads, never a blank body.
  return opensForms ? <HeldDeskLoading label="Opening Seclusion and restraint" /> : <SeclusionScreen />;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { ROLE_SCREENS } from "../ward-role-access";
import { SeclusionScreen } from "./seclusion-screen";

/** FS3: where seclusion and restraint in use now is recorded for a desk that opens Forms. */
const SECLUSION_IN_FORMS_HREF = "/ward-flow/legal-forms?view=seclusion";

/**
 * FS3 (Josh, 3 Nov 2026, Q29): Seclusion left the sidebar and its live view moved into Forms. Old
 * links and bookmarks still land here, so a desk that opens Forms is sent to that view. A site bed
 * manager has no Forms page (D-80), so it keeps this page as it was.
 */
export function SeclusionRoute() {
  const access = useEffectiveWardAccess();
  const router = useRouter();
  const opensForms = ROLE_SCREENS[access.role]["legal-forms"] !== undefined;
  useEffect(() => {
    if (opensForms) router.replace(SECLUSION_IN_FORMS_HREF);
  }, [opensForms, router]);
  return opensForms ? null : <SeclusionScreen />;
}

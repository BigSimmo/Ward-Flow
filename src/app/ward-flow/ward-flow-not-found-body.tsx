"use client";

import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { useCanOpenHref, useDeskHomeHref } from "@/components/ward-management/shell/ward-access";
import { patientSearchHref } from "@/components/ward-management/shell/ward-facade";

/**
 * The Ward Flow 404's words and ways on (PR #1474 review): Home is the desk's own home
 * (`homeHrefFor`), and the patient search shows only to a desk that can open it, so an executive or
 * admin desk is never offered a link to a screen its role does not have.
 */
export function WardFlowNotFoundBody() {
  const home = useDeskHomeHref();
  const canOpen = useCanOpenHref();
  return (
    <WardNotFoundBody
      title="Page not found"
      list={{ href: home, label: "Home" }}
      search={canOpen(patientSearchHref()) ? undefined : null}
    >
      This page is not in Ward Flow. The link may be wrong or out of date.
    </WardNotFoundBody>
  );
}

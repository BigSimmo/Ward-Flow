import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { WfServerPhoneProvider, guessPhoneFromRequest, guessTabletFromRequest } from "@/components/wf";
import { shouldBlockProductionMockups } from "@/proxy";

import { PreviewWorld } from "./_preview/preview-world";

/**
 * The redesign mock-ups (October 2026 design review). Each page is drawn from the components in
 * `src/components/ward-redesign/`, fed by the same synthetic world as `/ward-flow`, so an approved
 * page can move into the app as it is. Nothing here is built into the app until Josh approves that
 * page (D-74). Like every `/mockups` route it is not served in production; the layout checks that
 * itself as well as the proxy (A4-14).
 */
export default async function WardFlowRedesignLayout({ children }: { children: ReactNode }) {
  if (shouldBlockProductionMockups("/mockups/ward-flow-redesign")) notFound();
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");
  return (
    <WfServerPhoneProvider
      phone={guessPhoneFromRequest(userAgent, clientHintMobile)}
      tablet={guessTabletFromRequest(userAgent, clientHintMobile)}
    >
      <PreviewWorld>{children}</PreviewWorld>
    </WfServerPhoneProvider>
  );
}

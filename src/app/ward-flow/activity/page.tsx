"use client";

/**
 * WF-42: `/ward-flow/activity` is not a page. Activity is a shell panel, so an old or typed address
 * opens it on the desk's own home (`WardPanelAddress`).
 */
import { openActivityPanel } from "@/components/ward-management/shell/ward-activity-panel-store";
import { WardPanelAddress } from "@/components/ward-management/shell/ward-panel-address";

const openNotices = () => openActivityPanel({ tab: "notices" });

export default function WardActivityRedirectPage() {
  return <WardPanelAddress label="Activity" open={openNotices} />;
}

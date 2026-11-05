"use client";

/**
 * WF-42: `/ward-flow/help` is not a page. Help is a shell sheet, so an old or typed address opens it
 * on the desk's own home (`WardPanelAddress`).
 */
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import { WardPanelAddress } from "@/components/ward-management/shell/ward-panel-address";

const openTasks = () => openWardHelp("tasks");

export default function WardHelpRedirectPage() {
  return <WardPanelAddress label="Help" open={openTasks} />;
}

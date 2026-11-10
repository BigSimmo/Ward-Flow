import type { WardAccessRole } from "@/components/ward-management/ward-role-access";
import type { ToolsSheetToolId } from "@/components/ward-management/tools/ward-tools-sheet";

/**
 * QUICK BAR (Josh approved the mock-up, 8 Nov 2026: "Go ahead with all recommendations").
 * Each desk's most used controls sit in one row on the desk's home, one tap each. A control opens
 * its tool in the Tools side panel on the same page, so nothing here leaves the page. The list only
 * orders: every tool keeps its Tools gate, and the bar drops what the desk may not use.
 */
export type QuickControl =
  | { readonly kind: "tool"; readonly tool: ToolsSheetToolId; readonly label: string; readonly detail: string }
  | { readonly kind: "referral"; readonly label: string; readonly detail: string }
  /** A page the desk already has (page tops v6, Josh 9 Nov 2026: Home's Handover chip). */
  | { readonly kind: "link"; readonly href: string; readonly label: string; readonly detail: string };

const tool = (id: ToolsSheetToolId, label: string, detail: string): QuickControl => ({
  kind: "tool",
  tool: id,
  label,
  detail,
});
const referral: QuickControl = { kind: "referral", label: "New referral", detail: "Start one" };

/**
 * Most used first. Tools listed here must be panels (not page links) for that desk; a `link` opens an
 * existing page and is dropped when the desk may not open it.
 *
 * Page tops v6 (Josh, 9 Nov 2026: the mock-ups are the source of truth): the coordinator's set is
 * Home's mock-up chips. The other desk homes' mock-up chips are that page's own actions (Export,
 * Confirm numbers, Add patient and the like), which the page draws itself through `HeroTop`'s
 * `chips`; the Quick bar then steps aside there, and these sets serve only desk homes that do not.
 */
export const QUICK_BAR: Record<WardAccessRole, readonly QuickControl[]> = {
  coordinator: [
    tool("quick-actions", "Ward updates", "Not confirmed"),
    tool("bed-finder", "Find a bed", "Ready now"),
    tool("contacts", "Call and contacts", "Who is on"),
    { kind: "link", href: "/ward-flow/handover", label: "Handover", detail: "Shift handover" },
  ],
  bed_manager: [
    tool("bed-finder", "Find a bed", "Ready now"),
    tool("update-bed", "Update a bed", "Open or close"),
    tool("quick-actions", "Quick actions", "Broadcast and more"),
    tool("leave-due", "Due back", "Back today"),
    tool("messages", "Bed summary", "Copy for email"),
    tool("remind", "Remind me", "A nudge"),
  ],
  ward: [
    tool("leave-due", "Due back", "Back today"),
    tool("quick-actions", "Quick actions", "Confirm beds and more"),
    referral,
    tool("form-times", "Form times", "Form expiry"),
    tool("contacts", "On-call", "Who is on"),
    tool("remind", "Remind me", "A nudge"),
  ],
  ed: [
    referral,
    tool("bed-finder", "Find a bed", "Ready beds"),
    tool("form-times", "Form times", "Form expiry"),
    tool("contacts", "On-call", "Who is on"),
    tool("catchment", "Suburb lookup", "Team by suburb"),
    tool("remind", "Remind me", "A nudge"),
  ],
  community: [
    referral,
    tool("catchment", "Suburb lookup", "Team by suburb"),
    tool("contacts", "On-call", "Who is on"),
    tool("form-times", "Form times", "Form expiry"),
    tool("remind", "Remind me", "A nudge"),
  ],
  officer: [
    tool("contacts", "On-call", "Who is on"),
    tool("catchment", "Suburb lookup", "Team by suburb"),
    tool("remind", "Remind me", "A nudge"),
  ],
  executive: [
    tool("figures", "Key figures", "Beds and flow"),
    tool("messages", "Bed summary", "Copy text"),
    tool("contacts", "On-call", "Who is on"),
  ],
  admin: [tool("contacts", "On-call", "Who is on"), tool("catchment", "Suburb lookup", "Team by suburb")],
};

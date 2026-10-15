import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PhoneDirectory, PhoneFocal, PhoneSheet } from "@/components/ward-management/on-call/on-call-phone";
import {
  buildOnCallDirectory,
  numberAt,
  type DirectoryEntry,
  type DirectoryTab,
} from "@/components/ward-management/on-call/on-call-directory";
import type { ContactActions } from "@/components/ward-management/on-call/on-call-parts";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The On-call phone tree (390 by 844): the focal bed flow card, the inset grouped directory and the
 * contact bottom sheet. Rendered directly with the real synthetic directory, plus a few made-up
 * entries for the branches the fixture never reaches (no number, email only, nothing held). Every
 * number is the mock 08 0000 range and every address uses the reserved `.invalid` domain.
 */

const ENTRIES = buildOnCallDirectory();
const entry = (id: string) => ENTRIES.find((item) => item.id === id)!;

function makeActions(overrides: Partial<ContactActions> = {}): ContactActions {
  return {
    minute: NOW_ANCHOR,
    entries: ENTRIES,
    favourites: [],
    onPick: vi.fn(),
    onToggleFavourite: vi.fn(),
    onCopy: vi.fn(),
    onCall: vi.fn(),
    ...overrides,
  };
}

/** A made-up directory record; lines and email default to none. */
function synthetic(overrides: Partial<DirectoryEntry> & Pick<DirectoryEntry, "id" | "name">): DirectoryEntry {
  return {
    service: "Statewide",
    section: "statewide",
    group: "Synthetic group",
    groupTitle: "Synthetic group",
    kind: "line",
    place: "Synthetic place",
    purpose: "Synthetic purpose",
    lines: [],
    email: null,
    emailWindow: null,
    sendWith: [],
    note: "",
    checkedDaysAgo: 1,
    rostered: false,
    ...overrides,
  };
}

describe("PhoneFocal, the hero's bed flow card", () => {
  it("opens on the State bed desk with its number, its hours and what follows", () => {
    const actions = makeActions();
    render(<PhoneFocal entries={ENTRIES} actions={actions} onOpen={vi.fn()} />);

    const group = screen.getByRole("radiogroup", { name: "Bed flow for" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["State", "NMHS", "EMHS", "SMHS", "CAHS", "WACHS"]);
    expect(within(group).getByRole("radio", { name: "State" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("State bed desk")).toBeInTheDocument();
    expect(screen.getByText(numberAt(entry("sw-bfc"), NOW_ANCHOR)!)).toBeInTheDocument();
    expect(screen.getByText(/^Until/u)).toBeInTheDocument();
    expect(screen.getByText("then coordinator on call")).toBeInTheDocument();
  });

  it("switches service from the segmented control and reads 'then closed' when nothing follows", () => {
    render(<PhoneFocal entries={ENTRIES} actions={makeActions()} onOpen={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "CAHS" }));
    expect(screen.getByRole("radio", { name: "CAHS" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "State" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("CAHS bed flow")).toBeInTheDocument();
    expect(screen.getByText(numberAt(entry("cahs-bfc"), NOW_ANCHOR)!)).toBeInTheDocument();
    expect(screen.getByText("then closed")).toBeInTheDocument();
  });

  it("reads 'closed now' with the opening time when the line is shut", () => {
    render(<PhoneFocal entries={ENTRIES} actions={makeActions({ minute: 3 * 60 })} onOpen={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "WACHS" }));
    expect(screen.getByText("closed now")).toBeInTheDocument();
    expect(screen.getByText(/^Opens/u)).toBeInTheDocument();
  });

  it("calls, copies the number and opens details for the focal line", () => {
    const actions = makeActions();
    const onOpen = vi.fn();
    render(<PhoneFocal entries={ENTRIES} actions={actions} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("radio", { name: "NMHS" }));
    fireEvent.click(screen.getByRole("button", { name: "Call" }));
    expect(actions.onCall).toHaveBeenCalledWith(entry("nmhs-bfc"));

    fireEvent.click(screen.getByRole("button", { name: "Copy number" }));
    expect(actions.onCopy).toHaveBeenCalledWith(numberAt(entry("nmhs-bfc"), NOW_ANCHOR), "Number copied");

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onOpen).toHaveBeenCalledWith("nmhs-bfc");
  });

  it("keeps the MHERL crisis line one tap away, to open or to call", () => {
    const actions = makeActions();
    const onOpen = vi.fn();
    render(<PhoneFocal entries={ENTRIES} actions={actions} onOpen={onOpen} />);
    const crisis = entry("sw-mherl");
    const crisisNumber = numberAt(crisis, NOW_ANCHOR)!;

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^MHERL crisis line\\s*${crisisNumber}$`, "u") }));
    expect(onOpen).toHaveBeenCalledWith("sw-mherl");

    fireEvent.click(screen.getByRole("button", { name: `Call ${crisis.name}, ${crisisNumber}` }));
    expect(actions.onCall).toHaveBeenCalledWith(crisis);
  });

  it("shows 'Not held', no copy button and no crisis row when the line has no number", () => {
    const desk = synthetic({ id: "sw-bfc", name: "Synthetic desk", email: "desk@example.invalid" });
    render(<PhoneFocal entries={[desk]} actions={makeActions({ entries: [desk] })} onOpen={vi.fn()} />);

    expect(screen.getByText("Not held")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy number" })).not.toBeInTheDocument();
    expect(screen.queryByText("MHERL crisis line")).not.toBeInTheDocument();
    expect(screen.getByText("24 hours")).toBeInTheDocument();
  });

  it("falls back to the first entry when the State desk is missing, and copies email from the crisis row", () => {
    const first = synthetic({
      id: "first-line",
      name: "First line",
      lines: [{ label: "Desk", number: "08 0000 9001", window: null }],
    });
    const crisis = synthetic({ id: "sw-mherl", name: "Crisis inbox", email: "crisis@example.invalid" });
    const actions = makeActions({ entries: [first, crisis] });
    render(<PhoneFocal entries={[first, crisis]} actions={actions} onOpen={vi.fn()} />);

    expect(screen.getByText("08 0000 9001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy email for Crisis inbox" }));
    expect(actions.onCopy).toHaveBeenCalledWith("crisis@example.invalid", "Email copied");
  });
});

function renderDirectory(
  props: Partial<Parameters<typeof PhoneDirectory>[0]> & { tab: DirectoryTab; rows: readonly DirectoryEntry[] },
) {
  const actions = props.actions ?? makeActions();
  const onOpen = props.onOpen ?? vi.fn();
  const onClearQuery = props.onClearQuery ?? vi.fn();
  const view = render(
    <PhoneDirectory
      entries={ENTRIES}
      groupBy="place"
      actions={actions}
      isHighlighted={() => false}
      queryActive={false}
      hitCount={0}
      otherHits={[]}
      onClearQuery={onClearQuery}
      onOpen={onOpen}
      {...props}
    />,
  );
  return { ...view, actions, onOpen, onClearQuery };
}

const groupHeads = () => screen.getAllByRole("button", { expanded: true }).concat();

describe("PhoneDirectory, the inset grouped list", () => {
  const hospitals = ENTRIES.filter((item) => item.section === "hospitals");
  const statewide = ENTRIES.filter((item) => item.section === "statewide");

  it("opens only the first group and counts who answers in each service and group", () => {
    renderDirectory({ tab: "hospitals", rows: hospitals });

    const expanded = groupHeads();
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toHaveTextContent("Service wide");
    expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(5);
    expect(screen.getByText("North Metro")).toBeInTheDocument();
    expect(screen.getAllByText(/^\d+\/\d+$/u).length).toBeGreaterThan(1);
    expect(screen.queryByText(/Star any line to keep it here/u)).not.toBeInTheDocument();
  });

  it("opens a group on tap, shuts the previous one, and shuts it again on a second tap", () => {
    renderDirectory({ tab: "hospitals", rows: hospitals });
    const first = groupHeads()[0]!;
    const second = screen.getAllByRole("button", { expanded: false })[0]!;

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
  });

  it("opens a row's card and calls its line without opening the card", () => {
    const { actions, onOpen } = renderDirectory({ tab: "hospitals", rows: hospitals });
    const bfc = entry("nmhs-bfc");
    const number = numberAt(bfc, NOW_ANCHOR)!;

    fireEvent.click(screen.getByRole("button", { name: `Call ${bfc.name}, ${number}` }));
    expect(actions.onCall).toHaveBeenCalledWith(bfc);
    expect(onOpen).not.toHaveBeenCalled();

    const row = screen.getByRole("button", { name: `Call ${bfc.name}, ${number}` }).closest("li")!;
    fireEvent.click(within(row).getAllByRole("button")[0]!);
    expect(onOpen).toHaveBeenCalledWith("nmhs-bfc");
    expect(within(row).getByText(number)).toBeInTheDocument();
  });

  it("marks highlighted rows and dims the rest when dimming is on", () => {
    const highlighted = (item: DirectoryEntry) => item.id === "nmhs-bfc";
    renderDirectory({ tab: "hospitals", rows: hospitals, isHighlighted: highlighted, dimming: true });
    const items = screen.getAllByRole("listitem");

    const lit = items.filter((item) => item.hasAttribute("data-highlighted"));
    expect(lit).toHaveLength(1);
    expect(lit[0]).not.toHaveAttribute("data-dim");
    expect(items.filter((item) => item.getAttribute("data-dim") === "true")).toHaveLength(items.length - 1);
  });

  it("shows the search bar with hit count, other-section jumps and Clear, and opens every group with a hit", () => {
    const onShow = vi.fn();
    const hitIds = new Set(["nmhs-bfc", "emhs-bfc"]);
    const { onClearQuery } = renderDirectory({
      tab: "hospitals",
      rows: hospitals,
      queryActive: true,
      hitCount: 2,
      isHighlighted: (item) => hitIds.has(item.id),
      otherHits: [{ section: "community", label: "Community", count: 3, onShow }],
    });

    expect(screen.getByText("highlighted below")).toBeInTheDocument();
    expect(groupHeads().length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: "3 in Community" }));
    expect(onShow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearQuery).toHaveBeenCalledTimes(1);
  });

  it("groups hospitals by role, naming each row by its site and service", () => {
    renderDirectory({ tab: "hospitals", rows: hospitals, groupBy: "role" });

    const open = groupHeads()[0]!;
    expect(open).toHaveTextContent("EPIC, emergency physician in charge");
    const rows = within(open.closest("section")!).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(1);
    // A site row reads its hospital's title, not the role it already sits under.
    const epic = hospitals.find((item) => item.kind === "epic")!;
    expect(within(rows[0]!).getByText(epic.groupTitle)).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/^· (NMHS|EMHS|SMHS|CAHS|WACHS|Private)$/u)).toBeInTheDocument();
  });

  it("keeps the opened group per tab and grouping, so switching view opens that view's first group", () => {
    const { rerender, actions, onOpen, onClearQuery } = renderDirectory({ tab: "hospitals", rows: hospitals });
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]!);
    const common = {
      entries: ENTRIES,
      actions,
      isHighlighted: () => false,
      queryActive: false,
      hitCount: 0,
      otherHits: [],
      onClearQuery,
      onOpen,
    };

    rerender(<PhoneDirectory {...common} tab="statewide" rows={statewide} groupBy="place" />);
    const expanded = groupHeads();
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toHaveTextContent(statewide[0]!.groupTitle);
    // Statewide has no service blocks, so no service heading counts.
    expect(screen.queryByText("North Metro")).not.toBeInTheDocument();
  });

  it("shows a ward row with its place and an email-only row with a copy-email button", () => {
    const inbox = hospitals.find((item) => item.kind === "referralInbox" && item.lines.length === 0)!;
    const ward = hospitals.find((item) => item.kind === "nurseInCharge" && item.group === inbox.group)!;
    const { actions } = renderDirectory({ tab: "hospitals", rows: [ward, inbox] });

    const wardRow = screen.getByRole("button", { name: new RegExp(`^Call ${ward.name}`, "u") }).closest("li")!;
    expect(within(wardRow).getByText(`· ${ward.place}`)).toBeInTheDocument();

    const copy = screen.getByRole("button", { name: `Copy email for ${inbox.name}` });
    const inboxRow = copy.closest("li")!;
    expect(within(inboxRow).getByText("Email")).toBeInTheDocument();
    fireEvent.click(copy);
    expect(actions.onCopy).toHaveBeenCalledWith(inbox.email, "Email copied");
  });

  it("dims a shut line and shows when it opens", () => {
    const closed = entry("sw-gov");
    renderDirectory({ tab: "statewide", rows: [closed] });
    const row = screen.getByRole("button", { name: new RegExp(`^Call ${closed.name}`, "u") }).closest("li")!;
    expect(within(row).getByText(/^Opens/u)).toBeInTheDocument();
  });

  it("lists My list flat with no group headings and every row open", () => {
    const mine = [entry("sw-bfc"), entry("nmhs-bfc")];
    renderDirectory({ tab: "mine", rows: mine });

    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { expanded: false })).toHaveLength(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // My list names rows by role with the service tag, and the State desk has no site.
    expect(screen.getByText(entry("sw-bfc").name)).toBeInTheDocument();
  });

  it("shows the empty My list prompt when nothing is starred", () => {
    renderDirectory({ tab: "mine", rows: [] });
    expect(screen.getByText("Star any line to keep it here. My list stays in this browser.")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders a row with no number and no email without any call or copy button", () => {
    const silent = synthetic({ id: "silent", name: "Silent record" });
    renderDirectory({ tab: "statewide", rows: [silent] });
    const row = screen.getByText("Silent record").closest("li")!;
    expect(within(row).getAllByRole("button")).toHaveLength(1);
    expect(within(row).getByText("· Synthetic purpose")).toBeInTheDocument();
  });
});

describe("PhoneSheet, the contact bottom sheet", () => {
  it("names the contact and its service, and calls, copies and emails from the tiles", () => {
    const bfc = entry("nmhs-bfc");
    const number = numberAt(bfc, NOW_ANCHOR)!;
    const actions = makeActions();
    render(<PhoneSheet entry={bfc} actions={actions} notice={<p>Synthetic notice</p>} onClose={vi.fn()} />);

    const sheet = screen.getByRole("dialog", { name: bfc.name });
    expect(sheet).toHaveAttribute("data-testid", "ward-on-call-sheet");
    expect(sheet).toHaveAccessibleDescription("North Metro");
    expect(within(sheet).getByText("Synthetic notice")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: `Call ${number}` }));
    expect(actions.onCall).toHaveBeenCalledWith(bfc);
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy" }));
    expect(actions.onCopy).toHaveBeenCalledWith(number, "Number copied");
    fireEvent.click(within(sheet).getByRole("button", { name: "Email" }));
    expect(actions.onCopy).toHaveBeenCalledWith(bfc.email, "Email copied");
  });

  it("stars and shows Starred when the contact is on My list", () => {
    const bfc = entry("nmhs-bfc");
    const actions = makeActions();
    const { rerender } = render(<PhoneSheet entry={bfc} actions={actions} notice={null} onClose={vi.fn()} />);

    const star = screen.getByRole("button", { name: "Star" });
    expect(star).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(star);
    expect(actions.onToggleFavourite).toHaveBeenCalledWith("nmhs-bfc");

    rerender(
      <PhoneSheet entry={bfc} actions={{ ...actions, favourites: ["nmhs-bfc"] }} notice={null} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Starred" })).toHaveAttribute("aria-pressed", "true");
  });

  it("adds the place to the description for a ward and drops Call and Copy for an email-only inbox", () => {
    const inbox = ENTRIES.find((item) => item.kind === "referralInbox" && item.lines.length === 0)!;
    render(<PhoneSheet entry={inbox} actions={makeActions()} notice={null} onClose={vi.fn()} />);

    const sheet = screen.getByRole("dialog", { name: inbox.name });
    expect(sheet.getAttribute("aria-describedby")).toBeTruthy();
    expect(sheet).toHaveAccessibleDescription(new RegExp(`, Referral inbox, ${inbox.groupTitle}$`, "u"));
    expect(within(sheet).queryByRole("button", { name: /^Call / })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Email" })).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(<PhoneSheet entry={entry("sw-bfc")} actions={makeActions()} notice={null} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

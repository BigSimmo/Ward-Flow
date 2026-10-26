import { afterEach, describe, expect, it } from "vitest";
import { SharedWorkspaceClient, type SharedSnapshot } from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { holdOpenForm, openSheetHandles, popSheet, pushSheet } from "../src/components/wf/sheet-focus";

// Audit 4 A4-01: an inline form held open is checked like a popup (CS-19), so a save from it is
// sent against the board it opened on, not the newest board, and the server can refuse it.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

function setup() {
  const board = { revision: 1 };
  const sent: number[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: () => {},
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(board.revision) });
      sent.push(JSON.parse(String(options.body)).expectedRevision);
      board.revision += 1;
      return Response.json({
        outcome: "accepted",
        commandRevision: board.revision,
        snapshot: snapshot(board.revision),
      });
    },
  });
  return { client, board, sent };
}

describe("an inline edit form held open (audit A4-01)", () => {
  it("sends the revision the form opened on, so another desk's change meanwhile is checked", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    const release = holdOpenForm();
    board.revision = 2; // another desk saves while the form is open
    await client.refresh();
    await client.dispatch(event);
    release();
    release(); // safe twice
    expect(sent).toEqual([1]);
    client.dispose();
  });

  it("without an open form, sends the newest board as before", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    board.revision = 2;
    await client.refresh();
    await client.dispatch(event);
    expect(sent).toEqual([2]);
    client.dispose();
  });
});

// Audit CS3-01: every inline form is held, and a hold applies only to saves the form could send.
describe("which held forms a save is checked against (audit CS3-01)", () => {
  const added: HTMLElement[] = [];
  const releases: (() => void)[] = [];
  afterEach(() => {
    for (const release of releases.splice(0)) release();
    for (const element of added.splice(0)) element.remove();
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  function place(html: string) {
    const element = document.createElement("div");
    element.innerHTML = html;
    document.body.append(element);
    added.push(element);
    return element;
  }
  function hold(scope?: string) {
    const release = holdOpenForm(scope);
    releases.push(release);
    return release;
  }
  /** Saves from `control` after another desk has moved the board on, and returns what was sent. */
  async function saveFrom(control: HTMLElement | null, opened: () => void) {
    const { client, board, sent } = setup();
    await client.refresh();
    opened();
    board.revision = 2; // another desk saves while the form is open
    await client.refresh();
    control?.focus();
    await client.dispatch(event);
    client.dispose();
    return sent[0];
  }

  it("checks a save from the form's own row against the board the form opened on", async () => {
    const page = place(
      `<li data-held-form="movement:WF-A"><button id="a">Decline for A</button></li>` +
        `<li data-held-form="movement:WF-B"><button id="b">Accept B</button></li>`,
    );
    expect(await saveFrom(page.querySelector("#a"), () => hold("movement:WF-A"))).toBe(1);
  });

  it("does not refuse a save on another patient's row for the open form's sake", async () => {
    const page = place(
      `<li data-held-form="movement:WF-A"><button id="a">Decline for A</button></li>` +
        `<li data-held-form="movement:WF-B"><button id="b">Accept B</button></li>`,
    );
    expect(await saveFrom(page.querySelector("#b"), () => hold("movement:WF-A"))).toBe(2);
  });

  it("keeps the form in when the control used is in no marked place, so a form is never silently dropped", async () => {
    const page = place(`<li data-held-form="movement:WF-A"></li><div><button id="footer">Send decline</button></div>`);
    expect(await saveFrom(page.querySelector("#footer"), () => hold("movement:WF-A"))).toBe(1);
  });

  it("keeps the form in when the control used is unknown", async () => {
    place(`<li data-held-form="movement:WF-A"></li>`);
    expect(await saveFrom(null, () => hold("movement:WF-A"))).toBe(1);
  });

  it("counts a form named in an outer marked place", async () => {
    const page = place(
      `<section data-held-form="movement:WF-A"><div data-held-form="referral:RF-1"><button id="inner">Save</button></div></section>`,
    );
    expect(await saveFrom(page.querySelector("#inner"), () => hold("movement:WF-A"))).toBe(1);
  });

  it("keeps an unscoped hold in for every save while it is open", async () => {
    const page = place(`<li data-held-form="movement:WF-B"><button id="b">Accept B</button></li>`);
    expect(await saveFrom(page.querySelector("#b"), () => hold())).toBe(1);
  });
});

describe("a page form the person has used is held until it is sent (audit CS3-01 safety net)", () => {
  const added: HTMLElement[] = [];
  afterEach(() => {
    for (const element of added.splice(0)) element.remove();
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  function page() {
    const element = document.createElement("div");
    element.innerHTML =
      `<form id="form"><select id="choice"><option>Voluntary</option></select><button id="send">Record</button></form>` +
      `<button id="elsewhere">Something else</button>`;
    document.body.append(element);
    added.push(element);
    return element;
  }

  it("checks a save from inside the form against the board as it was when the person first used it", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    const view = page();
    view.querySelector<HTMLElement>("#choice")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    board.revision = 2;
    await client.refresh();
    view.querySelector<HTMLElement>("#send")!.focus();
    await client.dispatch(event);
    expect(sent).toEqual([1]);
    client.dispose();
  });

  it("does not hold a save made from outside the form", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    const view = page();
    view.querySelector<HTMLElement>("#choice")!.focus();
    board.revision = 2;
    await client.refresh();
    view.querySelector<HTMLElement>("#elsewhere")!.focus();
    await client.dispatch(event);
    expect(sent).toEqual([2]);
    client.dispose();
  });

  it("lets the form go once it is sent, and when it leaves the page", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    const view = page();
    const form = view.querySelector<HTMLFormElement>("#form")!;
    view.querySelector<HTMLElement>("#choice")!.focus();
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    board.revision = 2;
    await client.refresh();
    view.querySelector<HTMLElement>("#send")!.focus();
    await client.dispatch(event);
    // Used again after the earlier send: held from now on, at the board it now shows.
    expect(sent).toEqual([2]);
    const before = openSheetHandles().length;
    view.remove();
    expect(openSheetHandles().length).toBe(before - 1);
    client.dispose();
  });

  it("leaves a form inside a popup to the popup's own hold", async () => {
    const view = page();
    const opened = openSheetHandles().length;
    pushSheet("cs3-01-popup", view);
    view.querySelector<HTMLElement>("#choice")!.focus();
    expect(openSheetHandles().length).toBe(opened + 1);
    popSheet("cs3-01-popup");
  });
});

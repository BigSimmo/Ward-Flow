import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { SharedConfig } from "@/components/ward-management/shared/server/config";
import {
  handleSharedAccess,
  handleSharedEventsGet,
  handleSharedEventsPost,
  handleSharedJoin,
  type SharedHttpDeps,
} from "@/components/ward-management/shared/server/http";
import { createSharedWorldService } from "@/components/ward-management/shared/server/service";
import { createMemorySharedStateStore } from "./helpers/ward-flow-shared-memory-store";

/**
 * Feature 3 end to end in one process: two providers (two browsers) talk to the real route
 * handlers and service over a fake `fetch`, with the in-memory store standing in for Postgres.
 * Real timers: the browsers poll every 2 seconds, so a remote change can take that long to show.
 */

// A made-up code for tests only.
const CODE = "synthetic-test-access-code-0001";
const BUILD = "test-build";
const RELEASE = "derived-expected-AD-RPHS-05";
const SLOW = { timeout: 8_000 };

type Server = {
  memory: ReturnType<typeof createMemorySharedStateStore>;
  calls: { method: string; path: string; body: unknown }[];
  /** While set, POST /events waits for this promise before reaching the server. */
  holdPosts: Promise<void> | null;
  signedIn: boolean;
};

async function installServer(options: { signedIn?: boolean } = {}): Promise<Server> {
  const memory = createMemorySharedStateStore();
  const service = createSharedWorldService({ store: memory.store });
  const config: SharedConfig = {
    enabled: true,
    ready: true,
    databaseUrl: "postgres://unused",
    accessCode: CODE,
    typedTextAllowed: false,
    buildId: BUILD,
  };
  const deps: SharedHttpDeps = { config, service: () => service, failureDelayMs: 0 };
  const server: Server = { memory, calls: [], holdPosts: null, signedIn: options.signedIn ?? true };
  let jar = "";
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "https://ward-flow.test");
    const headers = new Headers(init?.headers);
    if (server.signedIn && jar) headers.set("cookie", jar);
    const request = new Request(url, { method: init?.method ?? "GET", headers, body: init?.body });
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    server.calls.push({ method: request.method, path: url.pathname, body });
    const route = `${request.method} ${url.pathname}`;
    if (route === "POST /api/ward-flow/shared/access") {
      const response = await handleSharedAccess(request, deps);
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        jar = setCookie.split(";")[0] ?? "";
        server.signedIn = true;
      }
      return response;
    }
    if (route === "POST /api/ward-flow/shared/join") return handleSharedJoin(request, deps);
    if (route === "GET /api/ward-flow/shared/events") return handleSharedEventsGet(request, deps);
    if (route === "POST /api/ward-flow/shared/events") {
      if (server.holdPosts) await server.holdPosts;
      return handleSharedEventsPost(request, deps);
    }
    return new Response(null, { status: 404 });
  };
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  if (server.signedIn) {
    // Sign in once, as a person typing the code would, so both browsers carry the cookie.
    const response = await handleSharedAccess(
      new Request("https://ward-flow.test/api/ward-flow/shared/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: CODE }),
      }),
      deps,
    );
    jar = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  }
  return server;
}

function Probe({ id }: { id: string }) {
  const { bedReleases, rejections, refreshRequests, dispatch, now } = useWardFlow();
  const release = bedReleases.find((candidate) => candidate.id === RELEASE);
  const fire = (event: WardFlowEvent) => dispatch(event);
  return (
    <section data-testid={id}>
      <span data-testid="release">{release?.state}</span>
      <span data-testid="rejections">{rejections.length}</span>
      <span data-testid="refreshes">{refreshRequests.length}</span>
      <button
        type="button"
        onClick={() =>
          fire({ type: "CONFIRM_BED_RELEASE", role: "ward", now, releaseId: RELEASE, actingUnitId: "rph-adult-secure" })
        }
      >
        confirm
      </button>
      <button
        type="button"
        onClick={() => fire({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: "rph-adult-secure" })}
      >
        refresh
      </button>
      <button
        type="button"
        onClick={() =>
          fire({
            type: "RECORD_MOVEMENT_BLOCKER",
            role: "coordinator",
            now,
            movementId: "WF-001",
            blocker: "Synthetic typed note",
          } as unknown as WardFlowEvent)
        }
      >
        typed
      </button>
    </section>
  );
}

function Browser({ id }: { id: string }) {
  return (
    <div data-testid={`${id}-root`}>
      <WardFlowProvider shared={{ enabled: true, buildId: BUILD }}>
        <Probe id={id} />
      </WardFlowProvider>
    </div>
  );
}

const statusOf = (id: string) =>
  within(screen.getByTestId(`${id}-root`)).getByText(
    (_, element) => element?.getAttribute("role") === "status" && element.tagName === "P",
  );

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared live state in the provider", () => {
  it("makes no request at all when shared mode is off", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <div data-testid="solo-root">
        <WardFlowProvider shared={{ enabled: false, buildId: BUILD }}>
          <Probe id="solo" />
        </WardFlowProvider>
      </div>,
    );
    fireEvent.click(within(screen.getByTestId("solo")).getByText("confirm"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(screen.getByTestId("solo")).getByTestId("release")).toHaveTextContent("confirmed");
    expect(screen.queryByText("Shared board")).toBeNull();
  });

  it("shows one browser's change in another, through the event log", async () => {
    const server = await installServer();
    render(
      <>
        <Browser id="a" />
        <Browser id="b" />
      </>,
    );
    await waitFor(() => expect(statusOf("a")).toHaveTextContent("Shared board"), SLOW);
    await waitFor(() => expect(statusOf("b")).toHaveTextContent("Shared board"), SLOW);
    expect(within(screen.getByTestId("b")).getByTestId("release")).toHaveTextContent("expected");

    fireEvent.click(within(screen.getByTestId("a")).getByText("confirm"));
    expect(within(screen.getByTestId("a")).getByTestId("release")).toHaveTextContent("confirmed");
    await waitFor(
      () => expect(within(screen.getByTestId("b")).getByTestId("release")).toHaveTextContent("confirmed"),
      SLOW,
    );

    const worldId = server.calls.find((call) => call.path.endsWith("/events") && call.method === "POST")?.body as {
      worldId: string;
    };
    expect(server.memory.eventRows(worldId.worldId).map((row) => row.event.type)).toEqual(["CONFIRM_BED_RELEASE"]);
  }, 30_000);

  it("on a conflict, the browser that lost catches up and sees its action refused", async () => {
    const server = await installServer();
    render(
      <>
        <Browser id="a" />
        <Browser id="b" />
      </>,
    );
    await waitFor(() => expect(statusOf("a")).toHaveTextContent("Shared board"), SLOW);
    await waitFor(() => expect(statusOf("b")).toHaveTextContent("Shared board"), SLOW);

    // Both confirm the same bed before either hears from the server.
    let release!: () => void;
    server.holdPosts = new Promise<void>((resolve) => {
      release = resolve;
    });
    fireEvent.click(within(screen.getByTestId("a")).getByText("confirm"));
    fireEvent.click(within(screen.getByTestId("b")).getByText("confirm"));
    expect(within(screen.getByTestId("a")).getByTestId("rejections")).toHaveTextContent("0");
    expect(within(screen.getByTestId("b")).getByTestId("rejections")).toHaveTextContent("0");
    server.holdPosts = null;
    await act(async () => {
      release();
    });

    // Exactly one browser's confirm was stored; the other shows a refusal and the same bed state.
    await waitFor(() => {
      const refusals = ["a", "b"].map((id) =>
        Number(within(screen.getByTestId(id)).getByTestId("rejections").textContent),
      );
      expect(refusals.sort()).toEqual([0, 1]);
    }, SLOW);
    for (const id of ["a", "b"])
      expect(within(screen.getByTestId(id)).getByTestId("release")).toHaveTextContent("confirmed");
    const posts = server.calls.filter((call) => call.method === "POST" && call.path.endsWith("/events"));
    const worldId = (posts[0]?.body as { worldId: string }).worldId;
    expect(server.memory.eventRows(worldId).map((row) => row.event.type)).toEqual(["CONFIRM_BED_RELEASE"]);
  }, 30_000);

  it("asks for the access code, then joins", async () => {
    const server = await installServer({ signedIn: false });
    render(<Browser id="a" />);
    await waitFor(() => expect(statusOf("a")).toHaveTextContent("needs the access code"), SLOW);
    // The app keeps working on this device meanwhile.
    fireEvent.click(within(screen.getByTestId("a")).getByText("refresh"));
    const input = within(screen.getByTestId("a-root")).getByLabelText("Access code");
    fireEvent.change(input, { target: { value: "wrong-code-0000000" } });
    fireEvent.click(within(screen.getByTestId("a-root")).getByRole("button", { name: "Join" }));
    await waitFor(
      () => expect(within(screen.getByTestId("a-root")).getByRole("alert")).toHaveTextContent("not accepted"),
      SLOW,
    );
    fireEvent.change(input, { target: { value: CODE } });
    fireEvent.click(within(screen.getByTestId("a-root")).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(statusOf("a")).toHaveTextContent(/^Shared board$/), SLOW);
    expect(server.calls.some((call) => call.path.endsWith("/join"))).toBe(true);
    // The access code itself is never sent anywhere but the access route.
    expect(
      server.calls
        .filter((call) => !call.path.endsWith("/access"))
        .some((call) => JSON.stringify(call.body ?? "").includes(CODE)),
    ).toBe(false);
  }, 30_000);

  it("never sends typed text: the browser leaves the board instead", async () => {
    const server = await installServer();
    render(<Browser id="a" />);
    await waitFor(() => expect(statusOf("a")).toHaveTextContent("Shared board"), SLOW);
    fireEvent.click(within(screen.getByTestId("a")).getByText("typed"));
    await waitFor(() => expect(statusOf("a")).toHaveTextContent("typed text is not shared"), SLOW);
    fireEvent.click(within(screen.getByTestId("a")).getByText("refresh"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    });
    const posted = server.calls.filter((call) => call.method === "POST" && call.path.endsWith("/events"));
    expect(posted).toEqual([]);
    expect(JSON.stringify(server.calls)).not.toContain("Synthetic typed note");
    // Browser storage stays untouched in shared mode.
    expect(window.sessionStorage.length).toBe(0);
  }, 30_000);
});

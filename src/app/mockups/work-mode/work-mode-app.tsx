"use client";

import { useRef } from "react";

import { AdminBody, AssessBody, CpdBody, TeachBody } from "./areas";
import { WorkContext } from "./context";
import { CustomiseSheet, DayBody, QuickAddSheet } from "./day";
import { RosterBody, SwapSheet } from "./roster";
import { SearchOverlay } from "./search";
import { IconSprite } from "./sprite";
import { headerCopy, MODES, modeSpec, type ModeId, type WorkModeAction, type WorkModeState } from "./state";
import { AppHeader, Icon, Sheet, Toast } from "./ui";

/**
 * One work-mode phone. The stage (`work-mode-stage.tsx`) owns its state, so the three phones on the
 * page share their records (a swap accepted on one shows on the others) while each keeps its own
 * screen.
 */
export function WorkModeApp({
  state,
  dispatch,
  label,
}: {
  state: WorkModeState;
  dispatch: (action: WorkModeAction) => void;
  label: string;
}) {
  const drag = useRef<number | null>(null);
  const mode = modeSpec(state.mode);
  const copy = headerCopy(state);

  function onTab(index: number) {
    dispatch({ type: "tab", index });
  }

  function onAction() {
    if (copy.action === "plus" && state.mode === "day") dispatch({ type: "overlay", overlay: "add" });
    else if (copy.action === "sliders" && state.mode === "day") dispatch({ type: "overlay", overlay: "customise" });
    else if (copy.action === "plus") dispatch({ type: "toast", message: "Nothing is sent until you confirm it." });
    else if (copy.action === "share")
      dispatch({ type: "toast", message: "Sharing stays on this phone until you choose where it goes." });
    else if (copy.action === "qrc")
      dispatch({ type: "toast", message: "The check-in code appears when the session opens." });
    else if (copy.action === "cal")
      dispatch({ type: "toast", message: "Calendar dates in this sample are October 2026." });
    else if (copy.action === "sliders") dispatch({ type: "toast", message: "Filters stay on this phone." });
  }

  function onSwipeEnd(clientX: number) {
    const start = drag.current;
    drag.current = null;
    if (start == null || state.overlay || state.view !== "main") return;
    const delta = clientX - start;
    if (delta <= -56 && state.tab < 2) dispatch({ type: "tab", index: state.tab + 1 });
    if (delta >= 56 && state.tab > 0) dispatch({ type: "tab", index: state.tab - 1 });
  }

  return (
    <WorkContext.Provider value={{ state, dispatch }}>
      <div className="phone" data-testid="work-mode-phone" role="region" aria-label={label}>
        <div
          className={`app fixed ${toneClass(mode.tone)}`}
          onPointerDown={(event) => {
            if (event.target instanceof Element && event.target.closest("button, input, a")) return;
            drag.current = event.clientX;
          }}
          onPointerUp={(event) => onSwipeEnd(event.clientX)}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <IconSprite />
          <AppHeader
            mode={mode}
            copy={copy}
            tab={state.tab}
            onMenu={() =>
              copy.back ? dispatch({ type: "view", view: "main" }) : dispatch({ type: "overlay", overlay: "modes" })
            }
            onMode={() => dispatch({ type: "overlay", overlay: "modes" })}
            onRight={() =>
              copy.right === "bell"
                ? dispatch({ type: "toast", message: "One sample alert: basic life support has lapsed." })
                : dispatch({ type: "overlay", overlay: "search" })
            }
            onAction={onAction}
            onTab={onTab}
          />
          <Screen state={state} />
          {state.toast ? <Toast message={state.toast} onUndo={() => dispatch({ type: "undo" })} /> : null}
          {state.overlay === "modes" ? <ModeSheet state={state} dispatch={dispatch} /> : null}
          {state.overlay === "more" ? <MoreSheet state={state} dispatch={dispatch} /> : null}
          {state.overlay === "add" ? (
            <Sheet title="Quick add" subtitle="Tuesday 6 October" onClose={() => dispatch({ type: "close" })}>
              <QuickAddSheet />
            </Sheet>
          ) : null}
          {state.overlay === "customise" ? (
            <Sheet
              title="Customise My Day"
              subtitle="Kept on this phone for your account"
              onClose={() => dispatch({ type: "close" })}
            >
              <CustomiseSheet />
              <button
                type="button"
                className="btn p w"
                style={{ marginTop: 12 }}
                onClick={() => dispatch({ type: "close" })}
              >
                Done
              </button>
            </Sheet>
          ) : null}
          {state.overlay === "swap" ? (
            <Sheet
              title="Swap with Dr Moss"
              subtitle="Answer by 17:00 today"
              onClose={() => dispatch({ type: "close" })}
            >
              <SwapSheet />
            </Sheet>
          ) : null}
          {state.overlay === "search" ? <SearchOverlay /> : null}
          <i className="hi" />
        </div>
      </div>
    </WorkContext.Provider>
  );
}

/**
 * The v6 token sheet uses `.day` and `.night` to force a theme on a subtree, so the My Day area's
 * tone class is renamed here; otherwise My Day would stay in day colours at night.
 */
function toneClass(tone: string): string {
  return tone === "day" || tone === "night" ? `tone-${tone}` : tone;
}

function Screen({ state }: { state: WorkModeState }) {
  if (state.mode === "day") return <DayBody />;
  if (state.mode === "rost") return <RosterBody />;
  if (state.mode === "teach") return <TeachBody />;
  if (state.mode === "assess") return <AssessBody />;
  if (state.mode === "cpd") return <CpdBody />;
  return <AdminBody />;
}

function ModeSheet({ state, dispatch }: { state: WorkModeState; dispatch: (action: WorkModeAction) => void }) {
  return (
    <Sheet title="Work mode" subtitle="Synthetic demonstration" onClose={() => dispatch({ type: "close" })}>
      <div className="sgrp">
        <div className="lbl">Areas</div>
        <div className="more-g">
          {MODES.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={state.mode === mode.id ? "more-i cur" : "more-i"}
              onClick={() => dispatch({ type: "mode", mode: mode.id })}
            >
              <span className={`ic ${toneClass(mode.tone)}`}>
                <Icon id={mode.icon} />
              </span>
              <span className="tx">
                <b>{mode.name}</b>
                <small>{mode.tabs[0].split("|")[0]}</small>
              </span>
              {state.mode === mode.id ? (
                <span className="ck">
                  <Icon id="check" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="more-ft" onClick={() => dispatch({ type: "overlay", overlay: "search" })}>
        <Icon id="search" />
        Search my work
      </button>
    </Sheet>
  );
}

const MORE: Record<ModeId, Array<[string, string, string, WorkModeAction]>> = {
  day: [
    ["sun", "Today", "Your day", { type: "tab", index: 0 }],
    ["cal", "Week", "5 to 11 Oct", { type: "tab", index: 1 }],
    ["clock", "Hours", "50.5 h this week", { type: "tab", index: 2 }],
    ["alert", "Needs you", "8 items", { type: "view", view: "needs" }],
    ["star5", "Starred", "9 items", { type: "toast", message: "Starred shortcuts stay on My Day." }],
    ["sliders", "Customise", "Cards on Today", { type: "overlay", overlay: "customise" }],
  ],
  rost: [
    ["cal", "Month", "October", { type: "tab", index: 0 }],
    ["users", "Team", "Ward 4", { type: "tab", index: 1 }],
    ["swap", "Swaps", "1 to answer", { type: "tab", index: 2 }],
    ["leave", "Leave", "10 days left", { type: "mode", mode: "day", tab: 2 }],
    ["pulse", "Hours and rest", "Within the agreement", { type: "mode", mode: "day", tab: 2 }],
  ],
  teach: [
    ["sun", "Today", "Next 12:30", { type: "tab", index: 0 }],
    ["cal", "Week", "8 sessions", { type: "tab", index: 1 }],
    ["book", "Logbook", "8 of 10 this term", { type: "tab", index: 2 }],
    ["award", "Log to CPD", "3 waiting", { type: "mode", mode: "cpd", tab: 1 }],
    ["doc", "Assessments", "2 due 15 Oct", { type: "mode", mode: "assess" }],
  ],
  assess: [
    ["doc", "To do", "4 requests", { type: "tab", index: 0 }],
    ["layers", "Progress", "This term", { type: "tab", index: 1 }],
    ["users", "Supervision", "2 to confirm", { type: "tab", index: 2 }],
    ["shield", "Admin dates", "Due Fri 9 Oct", { type: "mode", mode: "admin" }],
  ],
  cpd: [
    ["award", "Summary", "32.5 of 50 h", { type: "tab", index: 0 }],
    ["book", "Log", "41 activities", { type: "tab", index: 1 }],
    ["cal", "Learning", "Western Australia", { type: "tab", index: 2 }],
    ["board", "Teaching", "Journal club to log", { type: "mode", mode: "teach" }],
  ],
  admin: [
    ["grid", "Today", "4 to do", { type: "tab", index: 0 }],
    ["history", "Renewals", "7 to act on", { type: "tab", index: 1 }],
    ["case", "New job", "Starts 2 Nov", { type: "tab", index: 2 }],
    [
      "phone",
      "Help",
      "Crisis lines first",
      { type: "toast", message: "In a crisis call 000. The sample public line is MHERL 1300 555 788." },
    ],
  ],
};

function MoreSheet({ state, dispatch }: { state: WorkModeState; dispatch: (action: WorkModeAction) => void }) {
  const mode = modeSpec(state.mode);
  return (
    <Sheet title={mode.name} subtitle="All pages" onClose={() => dispatch({ type: "close" })}>
      <div className="sgrp">
        <div className="lbl">Pages</div>
        <div className="more-g">
          {MORE[state.mode].map((item) => {
            const current = item[3].type === "tab" && item[3].index === state.tab && state.view === "main";
            return (
              <button
                type="button"
                key={item[1]}
                className={current ? "more-i cur" : "more-i"}
                onClick={() => dispatch(item[3])}
              >
                <span className="ic">
                  <Icon id={item[0]} />
                </span>
                <span className="tx">
                  <b>{item[1]}</b>
                  <small>{item[2]}</small>
                </span>
                {current ? (
                  <span className="ck">
                    <Icon id="check" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="more-ft">
        <Icon id="sliders" />
        Three tabs, plus More
      </div>
    </Sheet>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import { helpLinkTask, subscribeWardHelp, type HelpRequest, type HelpView } from "./ward-help-events";
import { subscribeShortcutsKey } from "./ward-shortcuts-key";

// The sheet, the tour and their content load only when first needed, so every page's first load
// stays the same size.
const WardHelpSheet = dynamic(() => import("./ward-help-sheet").then((m) => m.WardHelpSheet));
const WardTour = dynamic(() => import("./ward-tour").then((m) => m.WardTour));
const WardShowMeAdmission = dynamic(() => import("./ward-show-me").then((m) => m.WardShowMeAdmission));
const WardShowMe = dynamic(() => import("./ward-show-me").then((m) => m.WardShowMe));
const WardTourAutoStart = dynamic(() => import("./ward-tour-auto-start").then((m) => m.WardTourAutoStart));
const WardHelpHints = dynamic(() => import("../help-content/ward-help-hints").then((m) => m.WardHelpHints));
const WardWhatsNew = dynamic(() => import("./ward-whats-new").then((m) => m.WardWhatsNew));

type Open = { view: HelpView; ask?: string; task?: string } | { showMe: string; navigationConfirmed?: boolean };

/**
 * Mounted once by the header. Draws nothing until something calls `openWardHelp`, `askWardHelp` or
 * `showWardHowTo`, except that a signed-in desk (role access on) checks whether its tour should
 * start on its own, and whether this device has a what's new note to read.
 */
export function WardHelpHost() {
  const [open, setOpen] = useState<Open | null>(null);
  const [arrival, setArrival] = useState(0);
  const [pending, setPending] = useState<{ id: string; sequence: number } | null>(null);
  const signedIn = useWardFeatureFlag("role-access");
  const askOn = useWardFeatureFlag("help-ask");
  useEffect(
    () =>
      subscribeWardHelp((request: HelpRequest) => {
        setPending(null);
        setArrival((value) => value + 1);
        if (request.kind === "view") setOpen({ view: request.view, task: request.task });
        else if (request.kind === "ask") setOpen({ view: "screen", ask: request.question });
        else {
          setOpen({ view: "tasks", task: request.id });
          setPending({ id: request.id, sequence: 1 });
        }
      }),
    [],
  );
  // A Help link ("#help=<id>") opens How to at that job, then the address is put back without it.
  useEffect(() => {
    const openFromLink = () => {
      const task = helpLinkTask(window.location.hash);
      if (!task) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      setPending(null);
      setArrival((value) => value + 1);
      setOpen({ view: "tasks", task });
    };
    openFromLink();
    window.addEventListener("hashchange", openFromLink);
    return () => window.removeEventListener("hashchange", openFromLink);
  }, []);
  // "?" anywhere opens the keyboard shortcuts (P120), now a view inside Help with Back to Help
  // (redesign, 1 Nov 2026), unless Help or the tour is already open.
  useEffect(() => subscribeShortcutsKey(() => setOpen((now) => now ?? { view: "keys" })), []);
  const startTour = useCallback(() => {
    setPending(null);
    setOpen({ view: "tour" });
  }, []);
  const setView = useCallback((view: HelpView) => {
    setPending(null);
    setOpen({ view });
  }, []);
  const close = useCallback(() => {
    setPending(null);
    setOpen(null);
  }, []);
  const showMe = useCallback(
    (id: string) => setPending((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 })),
    [],
  );
  const admit = useCallback((id: string) => {
    setPending(null);
    setOpen({ showMe: id, navigationConfirmed: true });
  }, []);
  const reject = useCallback((id: string) => {
    setPending(null);
    setOpen({ view: "tasks", task: id });
  }, []);
  if (pending && !askOn) setPending(null);
  if (open && "showMe" in open) {
    const id = open.showMe;
    return askOn ? (
      <WardShowMe id={id} navigationConfirmed={open.navigationConfirmed} onClose={close} onBack={() => reject(id)} />
    ) : (
      <WardHelpSheet
        key={arrival}
        view="tasks"
        task={id}
        showMeOn={false}
        onView={setView}
        onClose={close}
        onTour={startTour}
        onShowMe={showMe}
      />
    );
  }
  if (open?.view === "tour") return <WardTour onClose={close} />;
  if (open)
    return (
      <>
        {pending && askOn ? (
          <WardShowMeAdmission key={`guide-${pending.sequence}`} id={pending.id} onAdmit={admit} onReject={reject} />
        ) : null}
        <WardHelpSheet
          key={arrival}
          view={open.view}
          task={open.task}
          ask={open.ask ?? ""}
          showMeOn={askOn}
          onView={setView}
          onClose={close}
          onTour={startTour}
          onShowMe={showMe}
        />
      </>
    );
  return signedIn ? (
    <>
      <WardTourAutoStart onStart={startTour} />
      <WardWhatsNew />
      <WardHelpHints />
    </>
  ) : null;
}

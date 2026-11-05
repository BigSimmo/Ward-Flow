"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { Check, Compass } from "lucide-react";

import { Button } from "@/components/wf";

import { readTourStep, type WardTourRole } from "./ward-help-store";
import { tourChapters, useTourDevice } from "./ward-tour-device";
import { useTourFacts } from "./ward-tour-facts";
import { fullTourSteps } from "./ward-tour-more-steps";
import s from "./ward-help-panel.module.css";

// The welcome cards load only when asked for again here.
const WardTourWelcome = dynamic(() => import("./ward-tour-welcome").then((m) => m.WardTourWelcome), { ssr: false });

/**
 * The tour as one row in Help's How to: where this desk stopped, its chapters (a tick on those
 * walked), Start or Resume, and the welcome cards again, played inline in the row.
 */
export function TourRow({ role, onTour }: { role: WardTourRole; onTour: () => void }) {
  const device = useTourDevice();
  const { facts } = useTourFacts(role);
  const steps = useMemo(() => fullTourSteps(role, device, facts), [role, device, facts]);
  const chapters = useMemo(() => tourChapters(steps), [steps]);
  const total = steps.length;
  // The tour's own saved place (`ward-help-store`), read once when Help opens.
  const [at] = useState(() => Math.min(readTourStep(role), Math.max(0, total - 1)));
  const [welcome, setWelcome] = useState(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  const reopened = useRef(false);
  // "Not now" puts the cards away and focus back on the link that opened them.
  useEffect(() => {
    if (welcome) reopened.current = true;
    else if (reopened.current) linkRef.current?.focus();
  }, [welcome]);
  const minutes = Math.max(1, Math.round(((total - at) * (device === "phone" ? 12 : 15)) / 60));
  return (
    <div className={`${s.card} ${s.tour}`} data-testid="ward-help-tour-row">
      <div className={s.tourTop}>
        <span className={s.tourIcon} aria-hidden="true">
          <Compass aria-hidden="true" strokeWidth={1.75} />
        </span>
        <div className={s.tourText}>
          <b>Tour of your desk</b>
          <span>
            {at > 0 ? `Stopped at ${at + 1} of ${total}` : `${total} short steps`} · about {minutes} min
          </span>
        </div>
        <Button variant="sec" onClick={onTour} data-testid="ward-help-view-tour">
          {at > 0 ? "Resume" : "Start"}
        </Button>
      </div>
      <ol className={s.tourChapters} aria-label="Chapters" data-testid="ward-help-tour-chapters">
        {chapters.map((span) => {
          const done = span.start + span.count <= at;
          return (
            <li key={span.name} className={s.tourChapter} data-done={done ? "" : undefined}>
              {done ? <Check aria-hidden="true" strokeWidth={2.25} /> : null}
              {span.name}
              <span className={s.tourChapterCount}>
                {span.count}
                <span className="sr-only">
                  {span.count === 1 ? " step" : " steps"}
                  {done ? ", seen" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <span className={s.segments} aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} data-done={index < at ? "" : undefined} />
        ))}
      </span>
      {welcome ? (
        <div className={s.tourWelcome}>
          <WardTourWelcome inline onStart={onTour} onClose={() => setWelcome(false)} />
        </div>
      ) : (
        <button
          ref={linkRef}
          type="button"
          className={s.tourLink}
          onClick={() => setWelcome(true)}
          data-testid="ward-help-tour-welcome"
        >
          See the welcome again
        </button>
      )}
    </div>
  );
}

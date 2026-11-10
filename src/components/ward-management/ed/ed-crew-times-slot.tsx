"use client";

// Item 9: the crew times form draws only once a patient record is open, so its code loads after the
// first paint and is fetched when the browser is idle, the same approach as `EdObservationControl`
// (phone script budget). Until it has loaded, or if the fetch fails, nothing is drawn.
import { useEffect, useState, type ComponentProps } from "react";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { crewArrivalMode } from "@/components/ward-management/ward-crew-handover";

type CrewModule = typeof import("./ed-crew-times");
let loadedCrew: CrewModule | undefined;
const loadCrew = () => import("./ed-crew-times").then((m) => (loadedCrew = m));
preloadWhenIdle(loadCrew);

export function EdCrewTimesSlot(props: ComponentProps<CrewModule["EdCrewTimes"]>) {
  const [loaded, setLoaded] = useState(() => loadedCrew);
  const wanted = crewArrivalMode(props.movement) !== undefined;
  useEffect(() => {
    if (loaded || !wanted) return;
    let live = true;
    void loadCrew()
      .then((m) => {
        if (live) setLoaded(() => m);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [loaded, wanted]);
  const Crew = loaded?.EdCrewTimes;
  return wanted && Crew ? <Crew {...props} /> : null;
}

"use client";

// Item 9: the crew times form draws only once a patient record is open, so its code loads after the
// first paint and is fetched when the browser is idle, the same approach as `EdObservationControl`
// (phone script budget). Until it has loaded nothing is drawn; a failed fetch says so and offers Try
// again, so patchy Wi-Fi does not hide the crew controls until the record reopens. D-141: the
// same chunk carries "Brought by: Police / Ambulance", so it also loads for any open ED arrival.
import { useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/wf";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { canMarkBroughtBy, crewArrivalMode } from "@/components/ward-management/ward-crew-handover";

type CrewModule = typeof import("./ed-crew-times");
let loadedCrew: CrewModule | undefined;
const loadCrew = () => import("./ed-crew-times").then((m) => (loadedCrew = m));
preloadWhenIdle(loadCrew);

export function EdCrewTimesSlot(props: ComponentProps<CrewModule["EdArrivalCrew"]>) {
  const [loaded, setLoaded] = useState(() => loadedCrew);
  const [failed, setFailed] = useState(false);
  const wanted = crewArrivalMode(props.movement) !== undefined || canMarkBroughtBy(props.movement);
  useEffect(() => {
    if (loaded || failed || !wanted) return;
    let live = true;
    loadCrew()
      .then((m) => {
        if (live) setLoaded(() => m);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [loaded, failed, wanted]);
  const Crew = loaded?.EdArrivalCrew;
  if (!wanted) return null;
  if (Crew) return <Crew {...props} />;
  if (!failed) return null;
  return (
    <p role="status" data-testid="ward-ed-crew-load-failed">
      The crew details did not load.{" "}
      <Button variant="sec" onClick={() => setFailed(false)}>
        Try again
      </Button>
    </p>
  );
}

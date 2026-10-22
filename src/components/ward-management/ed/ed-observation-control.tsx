"use client";

// ED's way to change a waiting patient's observation level (PR #533, owner decision 22 Oct 2026).
// It is the ward drawer's own control, recorded against the open movement with
// `RECORD_OBSERVATION_LEVEL`. Phone script budget: the control draws only once a patient record is
// open, so its code loads after the first paint and is fetched when the browser is idle, the same
// approach as the ED preview (#559). Until it has loaded, or if the fetch fails, the recorded level
// is shown as text and nothing more.
import { useEffect, useState, type ComponentProps } from "react";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { observationSummary } from "@/components/ward-management/ward-observation";

type ControlModule = typeof import("@/components/ward-management/ward/ward-observation-control");
let loadedControl: ControlModule | undefined;
const loadControl = () =>
  import("@/components/ward-management/ward/ward-observation-control").then((m) => (loadedControl = m));
preloadWhenIdle(loadControl);

export function EdObservationControl(props: ComponentProps<ControlModule["WardObservationControl"]>) {
  const [loaded, setLoaded] = useState(() => loadedControl);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    void loadControl()
      .then((m) => {
        if (live) setLoaded(() => m);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [loaded]);
  const Control = loaded?.WardObservationControl;
  if (Control) return <Control {...props} />;
  return <p data-testid="ward-observation-current">{observationSummary(props.observation)}</p>;
}

"use client";

import { Button } from "@/components/wf";

import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";

import { startTraining, stopTraining, useTrainingMode } from "./ward-training-mode";

/**
 * Start or stop the training sandbox (feature 47). Through the unsaved-changes guard, because both
 * swap the whole world: a half-typed form belongs to the world it was started in.
 */
export function WardTrainingSwitch({ testId = "ward-training" }: { testId?: string }) {
  const training = useTrainingMode();
  return (
    <Button
      size="sm"
      variant={training ? "sec" : "pri"}
      onClick={() => navigateWithDirtyGuard(training ? stopTraining : startTraining)}
      data-testid={`${testId}-${training ? "stop" : "start"}`}
    >
      {training ? "Stop training" : "Start training"}
    </Button>
  );
}

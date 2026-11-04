import { useEffect, useRef, useState, type RefObject } from "react";
import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowContainer } from "./ward-flow-provider-container";
import type { FixtureWorlds } from "./ward-flow-typed-text-scrub";
import {
  deviceCopyOf,
  deviceSaveUnchanged,
  clearWardFlowDemoState,
  loadTypedTextScrub,
  tryWriteDemoState,
  type DeviceSaveInputs,
} from "./ward-flow-demo-storage";
import { markDemoSaveCurrent } from "./ward-flow-demo-save-marker";
import { seedSafeSenderId } from "./ward-flow-open-tabs-day";

/** Saving capability and a safely retained revision are different states. */
export function useDemoDeviceSave({
  shared,
  initialNow,
  mountedAtAbsolute,
  state,
  container,
  dayZero,
  nowRef,
  elapsedRef,
  fixtureWorlds,
  lastAdoptedBroadcastWorldRef,
  freshSeedRef,
  broadcastInstanceIdRef,
  savesOnDeviceRef,
}: {
  shared: boolean;
  initialNow: Instant | undefined;
  mountedAtAbsolute: number | null;
  state: WardFlowState;
  container: WardFlowContainer;
  dayZero: Date;
  nowRef: RefObject<Instant>;
  elapsedRef: RefObject<number>;
  fixtureWorlds: FixtureWorlds;
  lastAdoptedBroadcastWorldRef: RefObject<WardFlowState | null>;
  freshSeedRef: RefObject<boolean>;
  broadcastInstanceIdRef: RefObject<string>;
  savesOnDeviceRef: { current: boolean };
}) {
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [deviceCopyCheck, setDeviceCopyCheck] = useState<number | "loaded" | null>(null);
  const [saved, setSaved] = useState<DeviceSaveInputs>();
  const lastDeviceSaveRef = useRef<DeviceSaveInputs | undefined>(undefined);
  const locked = container.typedTextSeen && deviceCopyCheck === state.worldGeneration;
  const savingOnDevice = !shared && initialNow === undefined && !locked && !storageUnavailable;
  const inputs = { state, held: container, locked, dayZero, mountedAtAbsolute: mountedAtAbsolute ?? 0 };
  const current = Boolean(container.sessionAdopted) && deviceSaveUnchanged(saved, inputs);
  const saveStatus = current ? true : savingOnDevice ? ("pending" as const) : false;

  useEffect(() => {
    savesOnDeviceRef.current = current;
  }, [current, savesOnDeviceRef, container]);

  useEffect(() => {
    if (shared || initialNow !== undefined) return;
    if (current || (!container.typedTextSeen && !container.preAdoptionEvents?.length)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shared, initialNow, current, container.typedTextSeen, container.preAdoptionEvents]);

  useEffect(() => {
    if (
      shared ||
      initialNow !== undefined ||
      mountedAtAbsolute === null ||
      !container.sessionAdopted ||
      storageUnavailable
    )
      return;
    const saveInputs = { state, held: container, locked, dayZero, mountedAtAbsolute };
    if (deviceSaveUnchanged(lastDeviceSaveRef.current, saveInputs)) {
      markDemoSaveCurrent(true);
      return;
    }
    lastDeviceSaveRef.current = undefined;
    markDemoSaveCurrent(false);
    const deviceCopy = deviceCopyOf(state, container, locked, fixtureWorlds);
    let live = true;
    if (deviceCopy === undefined) {
      void loadTypedTextScrub().then(
        () => {
          if (live) setDeviceCopyCheck("loaded");
        },
        () => {
          if (live) setDeviceCopyCheck(state.worldGeneration);
        },
      );
    } else if (!deviceCopy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- report the result of the external safe-copy operation
      setDeviceCopyCheck(state.worldGeneration);
      if (!clearWardFlowDemoState()) setStorageUnavailable(true);
    } else if (
      !tryWriteDemoState(
        deviceCopy,
        dayZero,
        nowRef.current,
        mountedAtAbsolute + Math.max(0, elapsedRef.current),
        seedSafeSenderId(
          lastAdoptedBroadcastWorldRef.current === state || freshSeedRef.current,
          broadcastInstanceIdRef,
        ),
      )
    ) {
      setStorageUnavailable(true);
    } else {
      lastDeviceSaveRef.current = saveInputs;
      setSaved(saveInputs);
    }
    return () => {
      live = false;
    };
  }, [
    state,
    container,
    locked,
    deviceCopyCheck,
    initialNow,
    mountedAtAbsolute,
    dayZero,
    storageUnavailable,
    shared,
    fixtureWorlds,
    nowRef,
    elapsedRef,
    lastAdoptedBroadcastWorldRef,
    freshSeedRef,
    broadcastInstanceIdRef,
  ]);
  return {
    storageUnavailable,
    setStorageUnavailable,
    savingOnDevice,
    saveStatus,
    lastDeviceSaveRef,
    typedTextLocked: locked,
  };
}

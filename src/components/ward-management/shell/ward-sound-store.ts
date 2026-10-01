/**
 * WARD SOUND STORE — Web Audio API synthetic chime & buzzer alert store.
 *
 * Provides offline-first two-tone hospital chimes for urgent coordinator buzzes without
 * requiring external MP3/WAV assets. Gracefully handles SSR and environments without Web Audio.
 */

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

export const AUDIO_BUZZ_STORAGE_KEY = "ward-flow-audio-buzz-pref";
export const AUDIO_BUZZ_CHANGE_EVENT = "ward-flow-audio-buzz-change";
export const VISUAL_PULSE_STORAGE_KEY = "ward-flow-visual-pulse-pref";

let audioBuzzInMemoryFallback: boolean | undefined;
let visualPulseInMemoryFallback: boolean | undefined;
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/**
 * Synthesizes a gentle two-tone hospital chime using pure Web Audio API.
 * Tone 1: 520Hz sine wave for 0.12s
 * Tone 2: 660Hz sine wave for 0.25s
 * Volume <= 0.15 with exponential decay to 0.001.
 */
export function playSyntheticUrgentChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    // Gentle volume floor <= 0.15
    masterGain.gain.setValueAtTime(0.12, now);
    masterGain.connect(ctx.destination);

    // Tone 1: 520Hz sine wave for 0.12s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(520, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tone 2: 660Hz sine wave for 0.25s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.12);
    gain2.gain.setValueAtTime(0.14, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12 + 0.25);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.12 + 0.25);
  } catch {
    // Web Audio playback failures (autoplay policy, suspended context) never throw
  }
}

export function getAudioBuzzPreference(): boolean {
  if (audioBuzzInMemoryFallback !== undefined) {
    return audioBuzzInMemoryFallback;
  }
  try {
    if (typeof window === "undefined" || !window.localStorage) return true;
    const stored = window.localStorage.getItem(AUDIO_BUZZ_STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

export function setAudioBuzzPreference(enabled: boolean): void {
  audioBuzzInMemoryFallback = enabled;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(AUDIO_BUZZ_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new Event(AUDIO_BUZZ_CHANGE_EVENT));
    }
  } catch {
    // Graceful fallback for restricted environments
  }
}

function subscribeAudioBuzz(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUDIO_BUZZ_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUDIO_BUZZ_CHANGE_EVENT, onChange);
  };
}

const useAudioBuzzStore = createBrowserStore(subscribeAudioBuzz, getAudioBuzzPreference, true);

export function useAudioBuzzPreference(): [boolean, (enabled: boolean) => void] {
  const enabled = useAudioBuzzStore();
  const setEnabled = useCallback((next: boolean) => {
    setAudioBuzzPreference(next);
  }, []);
  return [enabled, setEnabled];
}

export function getVisualPulsePreference(): boolean {
  if (visualPulseInMemoryFallback !== undefined) {
    return visualPulseInMemoryFallback;
  }
  try {
    if (typeof window === "undefined" || !window.localStorage) return true;
    const stored = window.localStorage.getItem(VISUAL_PULSE_STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

export function setVisualPulsePreference(enabled: boolean): void {
  visualPulseInMemoryFallback = enabled;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(VISUAL_PULSE_STORAGE_KEY, String(enabled));
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Triggers the urgent buzz chime if audio is enabled in user preferences.
 */
export function triggerUrgentBuzzAlert(): void {
  if (getAudioBuzzPreference()) {
    playSyntheticUrgentChime();
  }
}

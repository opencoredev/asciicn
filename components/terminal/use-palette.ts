"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  applyPalette,
  DEFAULT_CUSTOM_HUE,
  DEFAULT_PALETTE,
  isPaletteId,
  normalizeHue,
  PALETTE_EVENT,
  PALETTE_HUE_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
} from "@/components/terminal/palette";
import type { PaletteId, PaletteState } from "@/components/terminal/palette";

const SERVER_STATE = `${DEFAULT_PALETTE}:${DEFAULT_CUSTOM_HUE}`;

// The DOM is the source of truth: the pre-paint script writes it before
// React runs, so reading it back never disagrees with what is on screen.
const readSnapshot = (): string => {
  const root = document.documentElement;
  const palette = isPaletteId(root.dataset.palette)
    ? root.dataset.palette
    : DEFAULT_PALETTE;
  const hue = normalizeHue(
    Number.parseFloat(root.style.getPropertyValue("--palette-hue"))
  );
  return `${palette}:${hue}`;
};

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener(PALETTE_EVENT, onChange);
  // Another tab changed it.
  const onStorage = (event: StorageEvent) => {
    if (
      event.key !== PALETTE_STORAGE_KEY &&
      event.key !== PALETTE_HUE_STORAGE_KEY
    ) {
      return;
    }
    const palette = localStorage.getItem(PALETTE_STORAGE_KEY);
    applyPalette({
      hue: Number.parseFloat(
        localStorage.getItem(PALETTE_HUE_STORAGE_KEY) ?? ""
      ),
      palette: isPaletteId(palette) ? palette : DEFAULT_PALETTE,
    });
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PALETTE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

const parseSnapshot = (snapshot: string): PaletteState => {
  const [palette, hue] = snapshot.split(":");
  return {
    hue: normalizeHue(Number.parseFloat(hue ?? "")),
    palette: isPaletteId(palette) ? palette : DEFAULT_PALETTE,
  };
};

const persist = (state: PaletteState): void => {
  applyPalette(state);
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, state.palette);
    localStorage.setItem(PALETTE_HUE_STORAGE_KEY, String(state.hue));
  } catch {
    // Storage blocked (private mode): the palette still applies for this page.
  }
  window.dispatchEvent(new Event(PALETTE_EVENT));
};

/**
 * The site palette and setters. Every component that calls it re-renders
 * when the palette changes, in this tab or another.
 */
export const usePalette = (): PaletteState & {
  setPalette: (palette: PaletteId) => void;
  setHue: (hue: number) => void;
} => {
  const snapshot = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => SERVER_STATE
  );
  const state = parseSnapshot(snapshot);

  const setPalette = useCallback((palette: PaletteId) => {
    persist({ hue: parseSnapshot(readSnapshot()).hue, palette });
  }, []);

  // Moving the hue always means "custom": dragging it is the custom palette.
  const setHue = useCallback((hue: number) => {
    persist({ hue: normalizeHue(hue), palette: "custom" });
  }, []);

  return { ...state, setHue, setPalette };
};

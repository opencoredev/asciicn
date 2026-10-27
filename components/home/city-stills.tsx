"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentType } from "react";

import { loadSource } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import type { AsciiFrame, AsciiHandle } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/**
 * Still frames of every city, for thumbnails that cost nothing to show.
 * `StillBaker` mounts one city at a time, offscreen-invisible and paused,
 * captures its first frame through the handle and unmounts it, so baking
 * every city never holds more than one extra WebGL context. Stills last
 * for the tab's session.
 */

const STORAGE_KEY = "asciicn-city-stills-v1";
// Gives a city that never draws (no WebGL, a broken chunk) up to this
// long before the baker moves on.
const BAKE_TIMEOUT_MS = 5000;
const POLL_MS = 120;

interface StoredFrame {
  c: number;
  r: number;
  g: string[];
  k: number[] | null;
  p: string | null;
}

/**
 * A baked frame and the paper it was drawn on. Coloured cities paint their
 * own background, so the still keeps it; mono ones follow the theme.
 */
export interface Still {
  readonly frame: AsciiFrame;
  readonly paper: string | null;
}

const stills = new Map<string, Still | null>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
};

const isStoredFrame = (value: unknown): value is StoredFrame =>
  typeof value === "object" &&
  value !== null &&
  "c" in value &&
  "r" in value &&
  "g" in value &&
  typeof value.c === "number" &&
  typeof value.r === "number" &&
  Array.isArray(value.g);

let restored = false;
const restore = () => {
  if (restored || typeof sessionStorage === "undefined") {
    return;
  }
  restored = true;
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? "{}"
    );
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }
    for (const [id, value] of Object.entries(parsed)) {
      if (isStoredFrame(value)) {
        stills.set(id, {
          frame: {
            colors: Array.isArray(value.k)
              ? new Uint8ClampedArray(value.k)
              : null,
            columns: value.c,
            glyphs: value.g.map(String),
            rows: value.r,
          },
          paper: "p" in value && typeof value.p === "string" ? value.p : null,
        });
      }
    }
  } catch {
    // Storage blocked or corrupt: bake again.
  }
};

const persist = () => {
  const out: Record<string, StoredFrame> = {};
  for (const [id, still] of stills) {
    if (still) {
      const { frame } = still;
      out[id] = {
        c: frame.columns,
        g: [...frame.glyphs],
        k: frame.colors ? [...frame.colors] : null,
        p: still.paper,
        r: frame.rows,
      };
    }
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // Quota or blocked storage: stills just won't survive a reload.
  }
};

/** Record a frame for a city (from the baker or a live stage). */
export const recordStill = (id: string, still: Still | null) => {
  if (still === null && stills.has(id)) {
    return;
  }
  stills.set(id, still);
  notify();
  if (still) {
    persist();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getVersion = () => version;
const getServerVersion = () => -1;

/** The still for a city: `null` if it can't be baked, `undefined` while pending. */
export const useStill = (id: string): Still | null | undefined => {
  useSyncExternalStore(subscribe, getVersion, getServerVersion);
  useEffect(restore, []);
  return stills.get(id);
};

const hasInk = (frame: AsciiFrame) =>
  frame.glyphs.some((glyph) => glyph !== " " && glyph !== "⠀");

/**
 * Bakes stills for `sources` while `active`. Render it once per page, near
 * the thumbnails it feeds.
 */
export const StillBaker = ({
  sources,
  active,
}: {
  sources: readonly StageSource[];
  active: boolean;
}) => {
  useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const [mounted, setMounted] = useState<{
    id: string;
    Component: ComponentType<AsciiSceneProps>;
  } | null>(null);
  const handle = useRef<AsciiHandle | null>(null);

  useEffect(restore, []);

  const next = active
    ? sources.find((source) => !stills.has(source.id))
    : undefined;

  useEffect(() => {
    if (!next) {
      setMounted(null);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const Component = await loadSource(next);
        if (live) {
          setMounted({ Component, id: next.id });
        }
      } catch {
        recordStill(next.id, null);
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [next]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const started = performance.now();
    const timer = setInterval(() => {
      const frame = handle.current?.capture() ?? null;
      if (frame && hasInk(frame)) {
        clearInterval(timer);
        recordStill(mounted.id, {
          frame,
          paper: frame.colors ? (handle.current?.colors().paper ?? null) : null,
        });
      } else if (performance.now() - started > BAKE_TIMEOUT_MS) {
        clearInterval(timer);
        recordStill(mounted.id, null);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [mounted]);

  if (!mounted || mounted.id !== next?.id) {
    return null;
  }
  const { Component } = mounted;
  // In the viewport (so the renderer gets a context) but invisible and
  // inert. 384×216 at 7px cells is a 91×30 frame: plenty for a card.
  return (
    <div
      aria-hidden
      inert
      className="pointer-events-none fixed bottom-0 left-0 -z-10 h-[216px] w-[384px] opacity-0"
    >
      <Component
        key={mounted.id}
        className="absolute inset-0"
        cell={7}
        animate={false}
        interactive={false}
        handle={handle}
      />
    </div>
  );
};

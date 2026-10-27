"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { useDocumentVisible, useInView } from "@/lib/ascii";
import type { AsciiFrame, AsciiHandle, CellMetrics } from "@/lib/ascii";

/**
 * Live numbers for a stage's status bar, read from the renderer's handle:
 * grid size, glyphs drawn, frame rate and run state. Polls twice a second
 * while the stage is on screen, and never while it is hidden.
 */

export type StageState = "loading" | "running" | "paused" | "static";

export interface StageProbe {
  readonly state: StageState;
  readonly columns: number;
  readonly rows: number;
  /** Non-space glyphs in the latest frame, or null before one is captured. */
  readonly glyphs: number | null;
  /** Frames per second the renderer is drawing, 0 when still. */
  readonly fps: number;
  /** Cell size in CSS px, measured or estimated from `cell`. */
  readonly cellWidth: number;
  readonly cellHeight: number;
}

const POLL_MS = 500;
// Every scene and shader on the site draws at 30 fps unless told otherwise.
export const STAGE_FPS = 30;

const readState = (root: Element | null): StageState => {
  const state = root?.querySelector<HTMLElement>("[data-state]")?.dataset.state;
  return state === "running" || state === "paused" || state === "static"
    ? state
    : "loading";
};

const countGlyphs = (frame: AsciiFrame) => {
  let count = 0;
  for (const glyph of frame.glyphs) {
    if (glyph !== " " && glyph !== "⠀") {
      count += 1;
    }
  }
  return count;
};

/**
 * Captures are copies (and a GPU readback), so callers share one that is at
 * most `maxAge` ms old.
 */
export const useFrameSampler = (handle: RefObject<AsciiHandle | null>) => {
  const cache = useRef<{ at: number; frame: AsciiFrame | null }>({
    at: 0,
    frame: null,
  });
  return (maxAge: number): AsciiFrame | null => {
    const now = performance.now();
    if (now - cache.current.at > maxAge) {
      cache.current = { at: now, frame: handle.current?.capture() ?? null };
    }
    return cache.current.frame;
  };
};

export const useStageProbe = ({
  root,
  handle,
  cell,
  sample,
}: {
  root: RefObject<HTMLElement | null>;
  handle: RefObject<AsciiHandle | null>;
  cell: number;
  sample: (maxAge: number) => AsciiFrame | null;
}): StageProbe => {
  const inView = useInView(root);
  const visible = useDocumentVisible();
  const estimate = {
    cellHeight: cell,
    cellWidth: Math.round(cell * 0.6 * 2) / 2,
  };
  const [probe, setProbe] = useState<StageProbe>({
    ...estimate,
    columns: 0,
    fps: 0,
    glyphs: null,
    rows: 0,
    state: "loading",
  });
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  useEffect(() => {
    if (!inView || !visible) {
      return;
    }
    // Count animation frames to know what the browser can deliver; the
    // renderer draws at most STAGE_FPS of them.
    let frames = 0;
    let raf = requestAnimationFrame(function tick() {
      frames += 1;
      raf = requestAnimationFrame(tick);
    });
    let last = performance.now();

    const read = () => {
      const el = root.current;
      const now = performance.now();
      const browserFps = (frames * 1000) / Math.max(1, now - last);
      frames = 0;
      last = now;
      const state = readState(el);
      const metrics: CellMetrics | null = handle.current?.metrics() ?? null;
      const cellWidth = metrics?.width ?? cell * 0.6;
      const cellHeight = metrics?.height ?? cell;
      const frame = sampleRef.current(POLL_MS / 2);
      const width = el?.clientWidth ?? 0;
      const height = el?.clientHeight ?? 0;
      setProbe({
        cellHeight,
        cellWidth,
        columns: frame?.columns ?? Math.floor(width / cellWidth),
        fps:
          state === "running" ? Math.round(Math.min(STAGE_FPS, browserFps)) : 0,
        glyphs: frame ? countGlyphs(frame) : null,
        rows: frame?.rows ?? Math.floor(height / cellHeight),
        state,
      });
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [inView, visible, root, handle, cell]);

  return probe;
};

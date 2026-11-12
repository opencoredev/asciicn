"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { useNearViewport } from "@/hooks/use-near-viewport";

/** The CSS size the catalog screenshots lay the demo out at. */
const STAGE_WIDTH = 495;
const STAGE_HEIGHT = 372;

/** Pause between two demos starting, so their shaders compile one at a time. */
const MOUNT_GAP_MS = 300;

interface Turn {
  start: () => void;
}

const pending: Turn[] = [];
let isPumping = false;
let activeTurn: Turn | null = null;
let cancelScheduled: (() => void) | null = null;

const pump = () => {
  const turn = pending.shift();
  if (!turn) {
    isPumping = false;
    activeTurn = null;
    return;
  }
  isPumping = true;
  activeTurn = turn;
  const run = () => {
    cancelScheduled = null;
    turn.start();
    setTimeout(pump, MOUNT_GAP_MS);
  };
  if ("requestIdleCallback" in window) {
    const id = requestIdleCallback(run, { timeout: 1500 });
    cancelScheduled = () => cancelIdleCallback(id);
  } else {
    const id = setTimeout(run, 200);
    cancelScheduled = () => clearTimeout(id);
  }
};

/**
 * Each shader compile blocks the main thread, so tiles queue up and start
 * one per idle slot instead of all at once when the page loads. Returns a
 * function that leaves the queue; a turn that unmounts before it runs passes
 * its slot on without the gap.
 */
const takeTurn = (start: () => void) => {
  const turn: Turn = { start };
  pending.push(turn);
  if (!isPumping) {
    pump();
  }
  return () => {
    const index = pending.indexOf(turn);
    if (index !== -1) {
      pending.splice(index, 1);
    } else if (turn === activeTurn && cancelScheduled) {
      cancelScheduled();
      cancelScheduled = null;
      pump();
    }
  };
};

/**
 * A background's docs demo, playing live over its catalog screenshot. It
 * lays out at the screenshot's size and scales down to the tile, so the two
 * line up. The demo loads once the tile nears the viewport and its turn in
 * the queue comes. Its shader shares the engine's context budget; without a
 * context it draws nothing here, so the screenshot underneath shows instead
 * of flat paper.
 */
export const CatalogLivePreview = ({ demo }: { demo: string }) => {
  const { isNear, ref } = useNearViewport<HTMLSpanElement>();
  const [scale, setScale] = useState(0);
  const [Demo, setDemo] = useState<ComponentType | null>(null);

  // The code loads before the tile takes its turn, so a slow download can't
  // push several demos into the same frames.
  useEffect(() => {
    if (!isNear) {
      return;
    }
    let isGone = false;
    let leave: (() => void) | undefined;
    const load = async () => {
      const mod = (await import(`@/examples/${demo}.tsx`)) as {
        default: ComponentType;
      };
      if (!isGone) {
        leave = takeTurn(() => setDemo(() => mod.default));
      }
    };
    load();
    return () => {
      isGone = true;
      leave?.();
    };
  }, [isNear, demo]);

  const measured = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = measured.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setScale((entry?.contentRect.width ?? 0) / STAGE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={(node) => {
        ref.current = node;
        measured.current = node;
      }}
      aria-hidden
      inert
      className="absolute inset-0 block overflow-hidden"
    >
      {Demo && scale > 0 ? (
        <span
          className="text-card-foreground absolute top-0 left-0 grid origin-top-left [--ascii-paper:var(--card)] *:min-h-0 *:min-w-0 [&_[data-ascii-fallback]]:hidden"
          style={{
            height: STAGE_HEIGHT,
            transform: `scale(${scale})`,
            width: STAGE_WIDTH,
          }}
        >
          <Demo />
        </span>
      ) : null}
    </span>
  );
};

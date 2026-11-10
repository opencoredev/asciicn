"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { useNearViewport } from "@/hooks/use-near-viewport";

/** The CSS size the catalog screenshots lay the demo out at. */
const STAGE_WIDTH = 495;
const STAGE_HEIGHT = 372;

/** Pause between two demos starting, so their shaders compile one at a time. */
const MOUNT_GAP_MS = 300;

const pending: (() => void)[] = [];
let isPumping = false;

const pump = () => {
  const next = pending.shift();
  if (!next) {
    isPumping = false;
    return;
  }
  isPumping = true;
  const run = () => {
    next();
    setTimeout(pump, MOUNT_GAP_MS);
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 200);
  }
};

/**
 * Each shader compile blocks the main thread, so tiles queue up and start
 * one per idle slot instead of all at once when the page loads. Returns a
 * function that leaves the queue.
 */
const takeTurn = (start: () => void) => {
  pending.push(start);
  if (!isPumping) {
    pump();
  }
  return () => {
    const index = pending.indexOf(start);
    if (index !== -1) {
      pending.splice(index, 1);
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
  const [isReady, setIsReady] = useState(false);
  const Demo = useMemo(
    () => dynamic(() => import(`@/examples/${demo}.tsx`), { ssr: false }),
    [demo]
  );

  useEffect(() => {
    if (!isNear) {
      return;
    }
    return takeTurn(() => setIsReady(true));
  }, [isNear]);

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
      {isReady && scale > 0 ? (
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

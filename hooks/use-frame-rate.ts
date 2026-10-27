"use client";

import { useEffect, useState } from "react";

/**
 * The page's measured frame rate, sampled twice a second, for status-bar
 * readouts. Returns null until the first sample and while `enabled` is
 * false. Stops sampling in hidden tabs (rAF pauses there anyway).
 */
export const useFrameRate = ({ enabled = true }: { enabled?: boolean } = {}):
  | number
  | null => {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFps(null);
      return;
    }
    let frames = 0;
    let since = performance.now();
    let id = 0;
    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - since;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        since = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [enabled]);

  return fps;
};

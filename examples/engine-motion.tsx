"use client";

import { useEffect, useRef, useState } from "react";

import { AsciiGrid, SPINNERS, eighthsBar, EIGHTHS_UP } from "@/lib/ascii";
import type { AsciiGridDrawContext } from "@/lib/ascii";
import { cn } from "@/lib/utils";

// A slow wave of eighth blocks with a clock and a spinner, so you can see
// time stop when the grid pauses, holds still or runs slower.
const drawWave = ({ frame, columns, rows, time }: AsciiGridDrawContext) => {
  const floor = rows - 2;
  for (let x = 0; x < columns; x += 1) {
    const height =
      (0.5 +
        0.28 * Math.sin(x * 0.11 + time * 0.9) +
        0.18 * Math.sin(x * 0.037 - time * 0.4)) *
      (floor - 2);
    const full = Math.floor(height);
    for (let y = 0; y < full; y += 1) {
      frame.put(x, floor - y, "█");
    }
    frame.put(x, floor - full, eighthsBar(height - full, 1, EIGHTHS_UP));
  }
  const spinner =
    SPINNERS.orbit[Math.floor(time * 10) % SPINNERS.orbit.length] ?? " ";
  frame.write(2, 1, `${spinner} t = ${time.toFixed(2)}s`);
};

const STATES = ["running", "paused", "static", "fallback"] as const;

// The speed button cycles through these.
const SPEEDS = [1, 0.25, 3] as const;

export default function EngineMotion() {
  const [animate, setAnimate] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [state, setState] = useState<string>("fallback");
  const ref = useRef<HTMLDivElement>(null);

  // Mirror the grid's data-state attribute into the readout.
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const read = () => setState(node.dataset.state ?? "fallback");
    read();
    const observer = new MutationObserver(read);
    observer.observe(node, {
      attributeFilter: ["data-state"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative size-full">
      <AsciiGrid
        ref={ref}
        className="absolute inset-0"
        cell={12}
        animate={animate}
        speed={speed}
        stillTime={3}
        draw={drawWave}
      />
      <div className="bg-background/90 absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs backdrop-blur-sm sm:inset-x-auto sm:right-4 sm:bottom-4">
        <span className="text-muted-foreground">data-state</span>
        {STATES.map((name) => (
          <span
            key={name}
            className={cn(
              "rounded-sm px-1.5 py-0.5",
              name === state
                ? "bg-ascii-ink text-background"
                : "text-muted-foreground"
            )}
          >
            {name}
          </span>
        ))}
        <button
          type="button"
          aria-pressed={!animate}
          onClick={() => setAnimate(!animate)}
          className="border-border hover:bg-muted focus-visible:ring-ring ml-1 rounded-sm border px-2 py-0.5 outline-none focus-visible:ring-2"
        >
          {animate ? "hold" : "play"}
        </button>
        <button
          type="button"
          onClick={() =>
            setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)
          }
          className="border-border hover:bg-muted focus-visible:ring-ring rounded-sm border px-2 py-0.5 tabular-nums outline-none focus-visible:ring-2"
        >
          speed {speed}×
        </button>
      </div>
    </div>
  );
}

"use client";

import { useId, useState } from "react";

import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid } from "@/lib/ascii";

// A custom ramp from empty to dense, typed live.
export default function EngineRamp() {
  const [chars, setChars] = useState(" .·:;+=xX$&");
  const [draw] = useState(createPlanetDraw);
  const id = useId();
  const valid = [...chars].length >= 2;

  return (
    <div className="relative size-full">
      <AsciiGrid
        className="absolute inset-0"
        cell={12}
        draw={(context) => draw(context, { chars: valid ? chars : undefined })}
      />
      <div className="bg-background/85 absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-md border px-3 py-2 backdrop-blur-sm sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
        <label
          htmlFor={id}
          className="text-muted-foreground shrink-0 font-mono text-xs"
        >
          chars
        </label>
        <input
          id={id}
          value={chars}
          spellCheck={false}
          onChange={(event) => setChars(event.target.value)}
          className="bg-muted focus-visible:ring-ring min-w-0 flex-1 rounded-sm px-2 py-1 font-mono text-sm whitespace-pre outline-none focus-visible:ring-2"
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { AsciiOrb } from "@/components/asciicn/ascii-orb";
import type { OrbState } from "@/components/asciicn/ascii-orb";

const NEXT: Record<OrbState, OrbState> = {
  idle: "listening",
  listening: "speaking",
  speaking: "idle",
};

const LABEL: Record<OrbState, string> = {
  idle: "tap to talk",
  listening: "listening…",
  speaking: "answering…",
};

export default function AsciiOrbAssistant() {
  const [state, setState] = useState<OrbState>("idle");

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4 border bg-background px-6 pt-4 pb-6">
      <AsciiOrb
        state={state}
        charset="braille"
        colors={["pink", "orange"]}
        size={0.7}
        cell={8}
        className="aspect-square w-full"
      />
      <button
        type="button"
        onClick={() => setState(NEXT[state])}
        className="border px-3 py-1.5 font-mono text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        [ {LABEL[state]} ]
      </button>
    </div>
  );
}

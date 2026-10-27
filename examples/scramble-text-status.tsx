"use client";

import { useEffect, useState } from "react";

import { ScrambleText } from "@/components/asciicn/scramble-text";

const STATES = [
  { label: "QUEUED", tone: "grey" },
  { label: "BUILDING", tone: "orange" },
  { label: "DEPLOYING", tone: "blue" },
  { label: "LIVE", tone: "green" },
] as const;

export default function ScrambleTextStatus() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((value) => (value + 1) % STATES.length),
      2200
    );
    return () => window.clearInterval(timer);
  }, []);
  const state = STATES[step] ?? STATES[0];

  return (
    <p className="flex items-baseline gap-3 font-mono text-sm">
      <span className="text-muted-foreground">deploy/4182</span>
      <ScrambleText
        glyphs="hex"
        trigger="mount"
        duration={0.25}
        color={state.tone}
        aria-live="polite"
        className="inline-block w-[9ch]"
        style={{ color: `var(--ascii-color-${state.tone})` }}
      >
        {state.label}
      </ScrambleText>
    </p>
  );
}

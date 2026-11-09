"use client";

import { useState } from "react";

import { AsciiCountdown } from "@/components/asciicn/ascii-countdown";

export default function AsciiCountdownDone() {
  // Five seconds out: watch the last ticks turn into the done text.
  const [launch, setLaunch] = useState(() => Date.now() + 5000);
  const [launched, setLaunched] = useState(false);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <AsciiCountdown
        to={launch}
        hideZeroDays
        doneText="WE ARE LIVE"
        onComplete={() => setLaunched(true)}
      />
      <button
        type="button"
        className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em] underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => {
          setLaunched(false);
          setLaunch(Date.now() + 5000);
        }}
      >
        {launched ? "Count again" : "Counting down"}
      </button>
    </div>
  );
}

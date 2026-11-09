"use client";

import { useState } from "react";

import { AsciiCountdown } from "@/components/asciicn/ascii-countdown";

const AHEAD = ((2 * 24 + 11) * 60 + 8) * 60_000 + 40_000;

export default function AsciiCountdownBanner() {
  const [launch] = useState(() => Date.now() + AHEAD);

  return (
    <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 border border-border px-4 py-3">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
        Public beta opens in
      </p>
      <div className="w-full max-w-72">
        <AsciiCountdown
          to={launch}
          size={22}
          cell={6}
          labels={false}
          accentOn="colons"
          ghost={false}
        />
      </div>
    </div>
  );
}

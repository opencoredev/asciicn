"use client";

import { useState } from "react";

import { AsciiCountdown } from "@/components/asciicn/ascii-countdown";

const AHEAD = ((14 * 24 + 6) * 60 + 52) * 60_000 + 3000;

export default function AsciiCountdownBraille() {
  const [launch] = useState(() => Date.now() + AHEAD);

  return (
    <div className="w-full max-w-4xl">
      <AsciiCountdown
        to={launch}
        charset="braille"
        colorMode="duotone"
        ramp="sodium"
        accentOn="colons"
      />
    </div>
  );
}

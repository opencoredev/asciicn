"use client";

import { useState } from "react";

import { AsciiCountdown } from "@/components/asciicn/ascii-countdown";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-countdown-controls";

// Nine days, four hours, thirty-seven minutes and twelve seconds out, so
// every column has a digit on the first frame.
const AHEAD = ((9 * 24 + 4) * 60 + 37) * 60_000 + 12_000;

export default function AsciiCountdownDemo() {
  const charset = usePreviewValue(knobs.charset);
  const accentOn = usePreviewValue(knobs.accentOn);
  const scramble = usePreviewValue(knobs.scramble);
  const colorMode = usePreviewValue(knobs.colorMode);
  const ghost = usePreviewValue(knobs.ghost);
  const [launch] = useState(() => Date.now() + AHEAD);

  return (
    <div className="w-full max-w-4xl">
      <AsciiCountdown
        to={launch}
        charset={charset}
        accentOn={accentOn}
        scramble={scramble}
        colorMode={colorMode}
        ghost={ghost}
      />
    </div>
  );
}

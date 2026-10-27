"use client";

import { AsciiMarquee } from "@/components/asciicn/ascii-marquee";
import type { AsciiMarqueeItem } from "@/components/asciicn/ascii-marquee";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-marquee-controls";

const QUOTES = [
  { change: 2.41, label: "GLYF", value: "182.40" },
  { change: -0.87, label: "BRLL", value: "41.06" },
  { change: 0.12, label: "CP437", value: "437.00" },
  { change: -3.3, label: "PTSC", value: "64.20" },
  { change: 5.02, label: "KTKN", value: "9.81" },
  { change: 1.17, label: "ANSI", value: "16.16" },
] as const satisfies readonly AsciiMarqueeItem[];

const INDICES = [
  { change: 0.64, label: "CELL-12", value: "1,204.8" },
  { change: -1.92, label: "RAMP-70", value: "870.3" },
  { change: 0.08, label: "TERM-80", value: "3,021.5" },
  { change: -0.33, label: "DOTS-2X4", value: "512.0" },
] as const satisfies readonly AsciiMarqueeItem[];

export default function AsciiMarqueeDemo() {
  const frame = usePreviewValue(knobs.frame);
  const separator = usePreviewValue(knobs.separator);
  const motion = usePreviewValue(knobs.motion);
  const direction = usePreviewValue(knobs.direction);
  const speed = usePreviewValue(knobs.speed);
  const secondRow = usePreviewValue(knobs.secondRow);

  return (
    <div className="w-full max-w-3xl">
      <AsciiMarquee
        items={QUOTES}
        secondRow={secondRow ? INDICES : undefined}
        label="GLYPH EXCHANGE"
        status="LIVE"
        frame={frame}
        separator={separator}
        motion={motion}
        direction={direction}
        speed={speed}
      />
    </div>
  );
}

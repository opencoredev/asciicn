"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Hong Kong. Victoria Harbour at night: dense towers mirrored in the water, with a junk boat drifting past. */
export const HongKong = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 4),
        Math.floor(rows / 2),
        "hong kong"
      );
    }}
  />
);

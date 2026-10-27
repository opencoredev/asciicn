"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Tokyo. Tokyo at night: Tokyo Tower over a skyline of lit towers, with neon signs flickering above busy streets. */
export const Tokyo = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 2),
        Math.floor(rows / 2),
        "tokyo"
      );
    }}
  />
);

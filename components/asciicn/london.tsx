"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** London. Big Ben and Tower Bridge in rolling fog over the Thames, with a red bus crossing. */
export const London = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 3),
        Math.floor(rows / 2),
        "london"
      );
    }}
  />
);

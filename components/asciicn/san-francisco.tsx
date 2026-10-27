"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** San Francisco. The Golden Gate Bridge as fog pours through the strait, with the city on its hills behind. */
export const SanFrancisco = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 6),
        Math.floor(rows / 2),
        "san francisco"
      );
    }}
  />
);

"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** New York. Manhattan at night: the Empire State and Chrysler buildings, thousands of lit windows and the Brooklyn Bridge over the river. */
export const NewYork = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 4),
        Math.floor(rows / 2),
        "new york"
      );
    }}
  />
);

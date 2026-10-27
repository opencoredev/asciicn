"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Paris. The Eiffel Tower sparkling over the Seine at twilight, with zinc rooftops and drifting clouds. */
export const Paris = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 2),
        Math.floor(rows / 2),
        "paris"
      );
    }}
  />
);

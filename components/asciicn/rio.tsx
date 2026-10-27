"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Rio de Janeiro. Sugarloaf Mountain over the bay and the Copacabana shoreline, with the statue on Corcovado above. */
export const Rio = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 7),
        Math.floor(rows / 2),
        "rio de janeiro"
      );
    }}
  />
);

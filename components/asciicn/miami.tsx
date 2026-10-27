"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Miami. Ocean Drive at dusk: art deco hotels glowing in neon pastels, swaying palms and a slow surf under a pink sky. */
export const Miami = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 2),
        Math.floor(rows / 2),
        "miami"
      );
    }}
  />
);

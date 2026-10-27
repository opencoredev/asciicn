"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Clockwork Orrery. A brass orrery of meshing gears driving planets on their arms; drag to spin the clockwork faster. */
export const OrreryScene = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 6),
        Math.floor(rows / 2),
        "clockwork or"
      );
    }}
  />
);

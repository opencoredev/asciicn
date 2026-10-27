"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Starling Murmuration. Thousands of starlings flocking at dusk, folding into ribbons and spheres; the pointer is a hawk they scatter from. */
export const MurmurationScene = ({
  className,
  style,
  handle,
}: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 6),
        Math.floor(rows / 2),
        "starling mur"
      );
    }}
  />
);

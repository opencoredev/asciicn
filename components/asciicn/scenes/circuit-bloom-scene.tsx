"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Silicon Bloom. Circuit traces growing like vines out of chips, with electrons racing along them; the pointer powers new branches. */
export const CircuitBloomScene = ({
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
        "silicon bloo"
      );
    }}
  />
);

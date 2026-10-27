"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Falling Sand Hourglass. Grains of sand pouring through an hourglass that turns itself over; the pointer tilts the glass and the sand follows. */
export const HourglassScene = ({
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
        "falling sand"
      );
    }}
  />
);

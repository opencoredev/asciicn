"use client";

// Placeholder until the city lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Dubai. The Burj Khalifa rising over a glittering skyline, with desert dunes and heat shimmer behind it. */
export const Dubai = ({ className, style, handle }: AsciiSceneProps) => (
  <AsciiGrid
    className={className}
    style={style}
    handle={handle}
    draw={({ frame, columns, rows }) => {
      frame.write(
        Math.max(0, Math.floor(columns / 2) - 2),
        Math.floor(rows / 2),
        "dubai"
      );
    }}
  />
);

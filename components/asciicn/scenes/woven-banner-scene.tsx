"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Woven Banner. A cloth banner woven from real words, rippling and folding in the wind; push or grab it with the pointer. */
export const WovenBannerScene = ({
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
        "woven banner"
      );
    }}
  />
);

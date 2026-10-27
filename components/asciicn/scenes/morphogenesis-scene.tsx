"use client";

// Placeholder until the scene lands, so the gallery, Studio and docs mount.
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** Glyph Morphogenesis. Coral, fingerprint and labyrinth patterns growing out of a reaction-diffusion field; the pointer seeds new growth. */
export const MorphogenesisScene = ({
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
        "glyph morpho"
      );
    }}
  />
);

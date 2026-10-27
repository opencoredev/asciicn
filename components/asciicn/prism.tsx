"use client";

import { SeedField } from "@/components/asciicn/seed-field";
import type { SeedFieldProps } from "@/components/asciicn/seed-field";
import type { SeedOptions } from "@/lib/ascii/seed";

export interface PrismProps extends Omit<
  SeedFieldProps,
  "kind" | "options" | "seed"
> {
  /** Any string. Each seed rolls a different field in the same family. Default `"prism"`. */
  seed?: string;
}

// Violet folds turning to teal: the turn crosses blue, never the muddy
// greens, and four or five ribbons keep the glass layered.
const PRISM = {
  hue: [302, 318],
  ribbons: { count: [4, 5], glow: [0.5, 0.85], width: [0.04, 0.068] },
  turn: [-128, -110],
  vividness: 1.1,
} as const satisfies SeedOptions;

/**
 * Layered glass folds in violet and teal, drawn in glyphs. Each seed bends
 * the ribbons differently and shifts the two hues within their families.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Prism = ({
  seed = "prism",
  charset = "standard",
  ...props
}: PrismProps) => (
  <SeedField
    {...props}
    seed={seed}
    kind="ribbons"
    options={PRISM}
    charset={charset}
  />
);

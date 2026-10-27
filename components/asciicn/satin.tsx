"use client";

import { SeedField } from "@/components/asciicn/seed-field";
import type { SeedFieldProps } from "@/components/asciicn/seed-field";
import type { SeedOptions } from "@/lib/ascii/seed";

export interface SatinProps extends Omit<
  SeedFieldProps,
  "kind" | "options" | "seed"
> {
  /** Any string. Each seed rolls a different field in the same family. Default `"satin"`. */
  seed?: string;
}

// Wide, slow folds of deep magenta with a soft sheen, in shade blocks.
const SATIN = {
  hue: [330, 346],
  ribbons: {
    count: [3, 4],
    fold: [0.2, 0.45],
    glow: [0.4, 0.6],
    twist: [0.7, 1.3],
    width: [0.06, 0.085],
  },
  turn: [-26, -10],
  vividness: 1.05,
} as const satisfies SeedOptions;

/**
 * Deep magenta satin: a few wide folds that turn slowly and catch the light
 * along their edges, in ANSI shade blocks. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const Satin = ({
  seed = "satin",
  charset = "blocks",
  ...props
}: SatinProps) => (
  <SeedField
    {...props}
    seed={seed}
    kind="ribbons"
    options={SATIN}
    charset={charset}
  />
);

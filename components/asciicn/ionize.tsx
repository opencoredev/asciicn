"use client";

import { SeedField } from "@/components/asciicn/seed-field";
import type { SeedFieldProps } from "@/components/asciicn/seed-field";
import type { SeedOptions } from "@/lib/ascii/seed";

export interface IonizeProps extends Omit<
  SeedFieldProps,
  "kind" | "options" | "seed"
> {
  /** Any string. Each seed rolls a different field in the same family. Default `"ionize"`. */
  seed?: string;
}

// Thin, hot ribbons in electric blue that cool towards cyan. The drift
// stays unhurried; the twist and glow carry the energy.
const IONIZE = {
  hue: [258, 270],
  ribbons: {
    drift: [0.045, 0.07],
    glow: [0.75, 0.95],
    twist: [1.8, 2.8],
    width: [0.022, 0.042],
  },
  turn: [-40, -22],
  vividness: 1.25,
} as const satisfies SeedOptions;

/**
 * Electric blue plasma ribbons: thin and bright, with a wide glow
 * and tight twists. Braille by default, so each ribbon draws as fine dots.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Ionize = ({
  seed = "ionize",
  charset = "braille",
  ...props
}: IonizeProps) => (
  <SeedField
    {...props}
    seed={seed}
    kind="ribbons"
    options={IONIZE}
    charset={charset}
  />
);

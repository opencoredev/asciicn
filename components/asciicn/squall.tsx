"use client";

import { SeedField } from "@/components/asciicn/seed-field";
import type { SeedFieldProps } from "@/components/asciicn/seed-field";
import type { SeedOptions } from "@/lib/ascii/seed";

export interface SquallProps extends Omit<
  SeedFieldProps,
  "kind" | "options" | "seed"
> {
  /** Any string. Each seed rolls a different field in the same family. Default `"squall"`. */
  seed?: string;
}

// Muted teal running to slate blue, with heavy folds and a steady drift,
// like rain bands crossing a sky.
const SQUALL = {
  hue: [190, 206],
  ribbons: {
    amplitude: [0.15, 0.22],
    count: [4, 5],
    drift: [0.045, 0.07],
    fold: [0.7, 1.1],
    glow: [0.35, 0.6],
  },
  turn: [26, 46],
  vividness: 0.62,
} as const satisfies SeedOptions;

/**
 * Stormy bands of teal and slate that churn and fold across the box, in
 * the classic ASCII ramp. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const Squall = ({
  seed = "squall",
  charset = "standard",
  ...props
}: SquallProps) => (
  <SeedField
    {...props}
    seed={seed}
    kind="ribbons"
    options={SQUALL}
    charset={charset}
  />
);

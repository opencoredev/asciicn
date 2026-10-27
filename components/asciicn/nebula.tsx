"use client";

import { SeedField } from "@/components/asciicn/seed-field";
import type { SeedFieldProps } from "@/components/asciicn/seed-field";

export interface NebulaProps extends Omit<
  SeedFieldProps,
  "kind" | "options" | "seed"
> {
  /** Any string. Each seed rolls a different field in the same family. Default `"nebula"`. */
  seed?: string;
}

/**
 * Cosmic gas drawn in glyphs: warped clouds with bright filaments and a
 * few stars behind them. Every seed rolls its own palette, shape and drift.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Nebula = ({
  seed = "nebula",
  charset = "quadrants",
  ...props
}: NebulaProps) => (
  <SeedField {...props} seed={seed} kind="nebula" charset={charset} />
);

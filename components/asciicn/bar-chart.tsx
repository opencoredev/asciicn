"use client";

import { useMemo } from "react";
import type { ComponentProps } from "react";

import { CartesianChart } from "@/components/asciicn/cartesian-chart";
import type {
  Accessor,
  BarSeries,
  ChartSeries,
  ChartStyleProps,
  NonEmpty,
} from "@/components/asciicn/cartesian-chart";

export type {
  Accessor,
  ChartSeries,
  ValueFormat,
} from "@/components/asciicn/cartesian-chart";

/** How several series share a category. */
export type BarLayout = "grouped" | "stacked" | "percent";

export interface BarChartProps<T>
  extends Omit<ComponentProps<"div">, "children">, ChartStyleProps {
  /** One entry per bar (or group of bars), in order. */
  data: readonly T[];
  /** Key (or function) for each bar's category label. */
  x: Accessor<T, string | number>;
  /** One or more series. With several, bars sit side by side or stack. */
  series: NonEmpty<ChartSeries<T>>;
  /**
   * `grouped`: series side by side. `stacked`: series on top of each
   * other. `percent`: stacked and scaled to 100%. Default `grouped`.
   */
  layout?: BarLayout;
  /**
   * `vertical` bars rise from the category axis. `horizontal` bars grow to
   * the right with their labels on the left and values at their ends; the
   * chart is as tall as its rows. Default `vertical`.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * The bar drawn solid (with its value written over it) while nothing is
   * scrubbed: an index, the `last`, the `max`, or `none`. Default `last`.
   */
  highlight?: number | "last" | "max" | "none";
}

const STACKS = {
  grouped: "none",
  percent: "percent",
  stacked: "stacked",
} as const satisfies Record<BarLayout, string>;

/**
 * A bar chart drawn in glyphs. Bars end in eighth blocks (rising, or
 * growing to the right when horizontal), so a bar's length is exact to an
 * eighth of a cell, over a body that fades from full block to light shade.
 * The highlighted or scrubbed bar draws solid. Several series group or
 * stack, each with its own texture.
 */
export const BarChart = <T,>({
  series,
  layout = "grouped",
  glyphs = "blocks",
  ...props
}: BarChartProps<T>) => {
  const bars = useMemo((): NonEmpty<BarSeries<T>> => {
    const [first, ...rest] = series;
    return [
      { ...first, type: "bar" },
      ...rest.map((entry) => ({ ...entry, type: "bar" as const })),
    ];
  }, [series]);
  return (
    <CartesianChart
      {...props}
      series={bars}
      stack={STACKS[layout]}
      glyphs={glyphs}
    />
  );
};

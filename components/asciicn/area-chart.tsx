"use client";

import { useMemo } from "react";
import type { ComponentProps } from "react";

import { CartesianChart } from "@/components/asciicn/cartesian-chart";
import type {
  Accessor,
  AreaSeries,
  ChartSeries,
  ChartStyleProps,
  NonEmpty,
} from "@/components/asciicn/cartesian-chart";

export type {
  Accessor,
  ChartSeries,
  ValueFormat,
} from "@/components/asciicn/cartesian-chart";

/** How several series combine. */
export type AreaStack = "none" | "stacked" | "percent";

export interface AreaChartProps<T>
  extends Omit<ComponentProps<"div">, "children">, ChartStyleProps {
  /** One entry per point along the x axis, in order. */
  data: readonly T[];
  /** Key (or function) for the x axis label, such as a date or month. */
  x: Accessor<T, string | number>;
  /** One or more series. Later series draw in front. */
  series: NonEmpty<ChartSeries<T>>;
  /**
   * `none`: series overlap, each from the baseline. `stacked`: each sits on
   * the ones before it. `percent`: stacked and scaled to 100%. Default `none`.
   */
  stack?: AreaStack;
  /** `smooth` (monotone, never overshoots) or `linear`. Default `smooth`. */
  curve?: "smooth" | "linear";
  /** Series markers on the edge: on every point, the `last`, or `none`. Default: `last` with two or more series. */
  markers?: "all" | "last" | "none";
}

/**
 * An area chart drawn in glyphs. With the default `blocks` glyphs each
 * column rises in eighth blocks, exact to an eighth of a cell, over a body
 * that fades from full blocks to light shade away from the edge. `braille`
 * draws the edge in dots over a body of thinning dots, `ascii` in plain
 * characters. Scrub it with the pointer or the arrow keys for a readout.
 */
export const AreaChart = <T,>({
  series,
  glyphs = "blocks",
  markers,
  ...props
}: AreaChartProps<T>) => {
  const areas = useMemo((): NonEmpty<AreaSeries<T>> => {
    const [first, ...rest] = series;
    return [
      { ...first, type: "area" },
      ...rest.map((entry) => ({ ...entry, type: "area" as const })),
    ];
  }, [series]);
  return (
    <CartesianChart
      {...props}
      series={areas}
      glyphs={glyphs}
      markers={markers ?? (series.length > 1 ? "last" : "none")}
    />
  );
};

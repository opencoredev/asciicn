"use client";

import { useMemo } from "react";
import type { ComponentProps } from "react";

import { CartesianChart } from "@/components/asciicn/cartesian-chart";
import type {
  Accessor,
  ChartStyleProps,
  LineSeries as CartesianLineSeries,
  NonEmpty,
} from "@/components/asciicn/cartesian-chart";

export type {
  Accessor,
  ValueFormat,
} from "@/components/asciicn/cartesian-chart";

/** One line: `{ label, value, color?, dashed?, range? }`. */
export type LineSeries<T> = Omit<CartesianLineSeries<T>, "type">;

export interface LineChartProps<T>
  extends
    Omit<ComponentProps<"div">, "children" | "fill">,
    Omit<ChartStyleProps, "fill"> {
  /** One entry per point along the x axis, in order. */
  data: readonly T[];
  /** Key (or function) for the x axis label, such as a date or month. */
  x: Accessor<T, string | number>;
  /** One or more lines, each with an optional range band. */
  series: NonEmpty<LineSeries<T>>;
  /** Point markers: on every point, on the `last` only, or `none`. Default `last`. */
  markers?: "all" | "last" | "none";
  /** Start the value axis at zero. Default false: it fits the data. */
  zero?: boolean;
  /** `smooth` (monotone, never overshoots) or `linear`. Default `smooth`. */
  curve?: "smooth" | "linear";
}

/**
 * A line chart drawn in glyphs. With the default `braille` glyphs every
 * line is plotted on a 2x4 dot grid inside each cell, so curves are four
 * times finer than the text around them. Each series ends in its own
 * marker glyph, and an optional range draws as a band of sparse dots.
 */
export const LineChart = <T,>({
  series,
  glyphs = "braille",
  markers = "last",
  zero = false,
  ...props
}: LineChartProps<T>) => {
  const lines = useMemo((): NonEmpty<CartesianLineSeries<T>> => {
    const [first, ...rest] = series;
    return [
      { ...first, type: "line" },
      ...rest.map((entry) => ({ ...entry, type: "line" as const })),
    ];
  }, [series]);
  return (
    <CartesianChart
      {...props}
      series={lines}
      glyphs={glyphs}
      markers={markers}
      zero={zero}
    />
  );
};

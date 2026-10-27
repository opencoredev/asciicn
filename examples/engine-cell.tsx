"use client";

import { useId, useState } from "react";

import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid } from "@/lib/ascii";
import type { CellMetrics } from "@/lib/ascii";

const format = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(2);

// Drag the cell height; the readout shows what `measureCell` snapped it to.
export default function EngineCell() {
  const [cell, setCell] = useState(12);
  const [draw] = useState(createPlanetDraw);
  const [info, setInfo] = useState<{
    metrics: CellMetrics;
    columns: number;
    rows: number;
  } | null>(null);
  const id = useId();

  return (
    <div className="relative size-full">
      <AsciiGrid
        className="absolute inset-0"
        cell={cell}
        animate={false}
        stillTime={2}
        draw={(context) => {
          draw(context, { charset: "standard" });
          const { metrics, columns, rows } = context;
          if (
            info?.metrics.deviceHeight !== metrics.deviceHeight ||
            info.metrics.deviceWidth !== metrics.deviceWidth ||
            info.columns !== columns ||
            info.rows !== rows
          ) {
            queueMicrotask(() => setInfo({ columns, metrics, rows }));
          }
        }}
      />
      <div className="bg-background/90 absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-md border px-3 py-2.5 backdrop-blur-sm sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80">
        <div className="flex items-center gap-3">
          <label
            htmlFor={id}
            className="text-muted-foreground shrink-0 font-mono text-xs"
          >
            cell
          </label>
          <input
            id={id}
            type="range"
            min={6}
            max={32}
            value={cell}
            onChange={(event) => setCell(Number(event.target.value))}
            className="accent-primary h-1 flex-1 cursor-pointer"
          />
          <output
            htmlFor={id}
            className="w-10 text-right font-mono text-xs tabular-nums"
          >
            {cell}px
          </output>
        </div>
        {info ? (
          <p className="text-muted-foreground font-mono text-[11px] leading-relaxed tabular-nums">
            {format(info.metrics.width)}×{format(info.metrics.height)} css px ·{" "}
            {info.metrics.deviceWidth}×{info.metrics.deviceHeight} device px @
            {info.metrics.dpr}x
            <br />
            font {format(info.metrics.fontSize)}px · {info.columns}×{info.rows}{" "}
            cells
          </p>
        ) : null}
      </div>
    </div>
  );
}

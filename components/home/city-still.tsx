"use client";

import { useEffect, useRef, useState } from "react";

import { useStill } from "@/components/home/city-stills";
import type { Still } from "@/components/home/city-stills";
import { charsetSweep, FramePre } from "@/components/home/frame-pre";
import type { StageSource } from "@/components/home/sources";
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiGridDrawContext } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** The box's width in CSS px, `0` until measured. */
const useWidth = (ref: React.RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

/**
 * A square-celled still drawn on a canvas from the glyph atlas, so its
 * dots are the same round shapes as the live scene. The cell is sized so
 * the still's columns fill the card; the grid samples the nearest cell.
 */
const DotStill = ({ still, width }: { still: Still; width: number }) => {
  const { frame } = still;
  const draw = ({ frame: out, columns, rows }: AsciiGridDrawContext) => {
    for (let row = 0; row < rows; row += 1) {
      const y = Math.min(frame.rows - 1, Math.floor((row * frame.rows) / rows));
      for (let column = 0; column < columns; column += 1) {
        const x = Math.min(
          frame.columns - 1,
          Math.floor((column * frame.columns) / columns)
        );
        const index = y * frame.columns + x;
        const glyph = frame.glyphs[index] ?? " ";
        if (glyph === " ") {
          continue;
        }
        const { colors } = frame;
        out.put(
          column,
          row,
          glyph,
          colors
            ? [
                colors[index * 4] ?? 0,
                colors[index * 4 + 1] ?? 0,
                colors[index * 4 + 2] ?? 0,
                colors[index * 4 + 3] ?? 255,
              ]
            : undefined
        );
      }
    }
  };
  return (
    <AsciiGrid
      draw={draw}
      cell={width / frame.columns}
      square
      colored={frame.colors !== null}
      animate={false}
      paper={still.paper ?? "transparent"}
      className="absolute inset-0"
    />
  );
};

/**
 * A background's still frame filling a 16:9 box. Dot backgrounds draw on
 * a canvas with square cells; others as text. Until the still is baked
 * (or if it can't be), the background's charset swept across the box.
 */
export const CityStill = ({
  source,
  className,
}: {
  source: StageSource;
  className?: string;
}) => {
  const still = useStill(source.id);
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useWidth(boxRef);
  const dots = source.charset === "dots";
  return (
    <div
      ref={boxRef}
      className={cn(
        "bg-ascii-paper @container relative aspect-video overflow-hidden",
        className
      )}
    >
      {still && dots && width > 0 ? (
        <DotStill still={still} width={width} />
      ) : null}
      {still && !dots ? (
        <FramePre
          frame={still.frame}
          className="absolute inset-0"
          style={still.paper ? { background: still.paper } : undefined}
        />
      ) : null}
      {still ? null : (
        <FramePre
          frame={charsetSweep(source.charset)}
          className={cn(
            "absolute inset-0 opacity-35 transition-opacity duration-300",
            still === undefined && "motion-safe:animate-pulse"
          )}
        />
      )}
    </div>
  );
};

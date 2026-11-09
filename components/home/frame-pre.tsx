import { Fragment } from "react";
import type { CSSProperties } from "react";

import { createToneField, fillToneField, mapTones } from "@/lib/ascii";
import type { AsciiFrame, CharsetName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * A captured frame as real text in a `<pre>`, coloured in runs. It sizes
 * its glyphs to the container's width (container query units), so a frame
 * of any size fills its card exactly. Static: costs no canvas or context.
 */

interface Run {
  readonly text: string;
  readonly color: string | null;
}

// The canvases draw the in-between halftone dots as shapes, but the text
// font has no glyph for them, so text shows their nearest neighbours.
const TEXT_SAFE: Readonly<Record<string, string>> = { "∙": "·", "⦁": "●" };

// Neighbouring cells rarely share an exact colour; snapping to 16 levels
// per channel keeps the number of spans small without visible banding.
const snap = (value: number) => Math.min(255, Math.round(value / 16) * 16);

const frameRuns = (frame: AsciiFrame): Run[][] => {
  const lines: Run[][] = [];
  for (let row = 0; row < frame.rows; row += 1) {
    const runs: Run[] = [];
    let text = "";
    let color: string | null = null;
    for (let column = 0; column < frame.columns; column += 1) {
      const index = row * frame.columns + column;
      const raw = frame.glyphs[index] ?? " ";
      const glyph = TEXT_SAFE[raw] ?? raw;
      const { colors } = frame;
      const next =
        glyph !== " " && colors && colors[index * 4 + 3] > 0
          ? `rgb(${snap(colors[index * 4])} ${snap(colors[index * 4 + 1])} ${snap(colors[index * 4 + 2])})`
          : null;
      // Spaces take any colour, so they never split a run.
      if (glyph !== " " && next !== color) {
        if (text) {
          runs.push({ color, text });
        }
        text = "";
        color = next;
      }
      text += glyph;
    }
    runs.push({ color, text });
    lines.push(runs);
  }
  return lines;
};

// The Cascadia Mono advance, in em.
const ADVANCE = 0.586;

export const FramePre = ({
  frame,
  square = false,
  className,
  style,
}: {
  frame: AsciiFrame;
  /** The frame was drawn on square cells: rows sit one glyph width apart. Default `false`. */
  square?: boolean;
  className?: string;
  style?: CSSProperties;
}) => (
  <pre
    aria-hidden
    className={cn(
      "text-ascii-ink m-0 overflow-hidden font-mono leading-[1.2] whitespace-pre select-none",
      className
    )}
    style={{
      ...style,
      fontSize: `calc(100cqw / ${frame.columns} / ${ADVANCE})`,
      ...(square ? { lineHeight: ADVANCE } : {}),
    }}
  >
    {frameRuns(frame).map((runs, row) => (
      // Rows never reorder.
      // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
      <Fragment key={row}>
        {runs.map((run, index) =>
          run.color ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional
            <span key={index} style={{ color: run.color }}>
              {run.text}
            </span>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional
            <Fragment key={index}>{run.text}</Fragment>
          )
        )}
        {row < frame.rows - 1 ? "\n" : null}
      </Fragment>
    ))}
  </pre>
);

/**
 * A charset's own ramp swept corner to corner, for a card whose city
 * hasn't been captured yet. Honest about what it is: the glyphs the city
 * draws with, not a picture of the city.
 */
export const charsetSweep = (
  charset: CharsetName,
  columns = 48,
  rows = 18
): AsciiFrame => {
  const field = createToneField(columns, rows, charset);
  fillToneField(field, (u, v) => {
    const x = u - 0.5;
    const y = (v - 0.5) * 0.9;
    const ring = Math.hypot(x, y);
    return Math.max(0, Math.min(1, 1.05 - ring * 1.9)) ** 1.4;
  });
  return mapTones(field, columns, rows, { charset });
};

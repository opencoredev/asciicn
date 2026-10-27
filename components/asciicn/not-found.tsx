"use client";

import { useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { cssColor, useFrameLoop } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

/**
 * A hairline stroke in the text colour. Adjacent block glyphs meet at
 * fractional pixels, where anti-aliasing leaves a faint seam; the stroke
 * covers it without visibly thickening the glyphs.
 */
const SEAL = { WebkitTextStroke: "0.045em currentColor" } as const;

export interface NotFoundProps extends Omit<
  ComponentProps<"div">,
  "title" | "color"
> {
  /** The status code drawn in big glyphs. Digits only. Default `"404"`. */
  code?: string;
  /** The heading. Default `"Page not found"`. */
  title?: ReactNode;
  /** A sentence under the heading. */
  description?: ReactNode;
  /** The path that failed, shown as a shell line: `$ open /path`. */
  path?: string;
  /** The shell's reply under the path, with a blinking cursor. Default `"no such page"`. */
  detail?: string;
  /** Links or buttons, such as back home and search. */
  actions?: ReactNode;
  /** Heading level of the title. Default `"h1"`. */
  titleAs?: "h1" | "h2" | "h3";
  /** Glyph the digits are built from. Default `"█"`. */
  glyph?: string;
  /** Steps of shaded extrusion behind the digits, 0 to 3. Default 2. */
  depth?: number;
  /** Colour of the digits: a palette name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Twinkle the stars, scan the digits and blink the cursor. Default true; still under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default 14. */
  cell?: number;
}

/** A 5x7 bitmap face for the code, one string per row. */
const DIGITS: Record<string, readonly string[]> = {
  "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
};
const UNKNOWN = ["#####", "#...#", "...#.", "..#..", "..#..", ".....", "..#.."];

const DIGIT_ROWS = 7;
/** A font pixel is two cells wide and one tall: square, since cells are about 1:2. */
const PIXEL_COLUMNS = 2;
const DIGIT_GAP = 2;
const MARGIN_X = 4;
const MARGIN_Y = 2;
const SHADES = ["░", "░", "·"] as const;
const STAR_GLYPHS = ["·", "+", "*", "+"] as const;
const STAR_COUNT = 16;
const FPS = 10;
/** Seconds for the scan row to pass down the digits once. */
const SCAN_SECONDS = 2.8;

type Tone = "digit" | "scan" | "shade" | "star" | "blank";

interface Cell {
  glyph: string;
  tone: Tone;
}

/** A small seeded generator, so the stars land in the same places on the server and the client. */
const seeded = (seed: number) => {
  let state = seed % 2_147_483_647 || 1;
  return () => {
    state = (state * 48_271) % 2_147_483_647;
    return state / 2_147_483_647;
  };
};

interface Layout {
  readonly columns: number;
  readonly rows: number;
  /** Lit font pixels as [column, row] cells of the left half of each pixel. */
  readonly pixels: readonly (readonly [number, number])[];
  readonly stars: readonly { x: number; y: number; phase: number }[];
}

const layoutCode = (code: string, depth: number): Layout => {
  const digits = [...code].map((char) => DIGITS[char] ?? UNKNOWN);
  const digitWidth = 5 * PIXEL_COLUMNS;
  const codeWidth =
    digits.length * digitWidth + Math.max(0, digits.length - 1) * DIGIT_GAP;
  const columns = codeWidth + depth * PIXEL_COLUMNS + MARGIN_X * 2;
  const rows = DIGIT_ROWS + depth + MARGIN_Y * 2;
  const pixels: [number, number][] = [];
  for (const [index, digit] of digits.entries()) {
    const left = MARGIN_X + index * (digitWidth + DIGIT_GAP);
    for (const [row, line] of digit.entries()) {
      for (const [column, mark] of [...line].entries()) {
        if (mark === "#") {
          pixels.push([left + column * PIXEL_COLUMNS, MARGIN_Y + row]);
        }
      }
    }
  }
  const random = seeded(
    [...code].reduce((sum, char) => sum * 31 + (char.codePointAt(0) ?? 0), 7)
  );
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    phase: random(),
    x: Math.floor(random() * columns),
    y: Math.floor(random() * rows),
  }));
  return { columns, pixels, rows, stars };
};

/** The scene at `time` seconds: stars, extrusion, digits and the scan row. */
const drawScene = (
  layout: Layout,
  { time, glyph, depth }: { time: number; glyph: string; depth: number }
): Cell[][] => {
  const grid: Cell[][] = Array.from({ length: layout.rows }, () =>
    Array.from({ length: layout.columns }, () => ({
      glyph: " ",
      tone: "blank" as Tone,
    }))
  );
  const put = (x: number, y: number, cell: Cell) => {
    const row = grid[y];
    if (row && x >= 0 && x < layout.columns) {
      row[x] = cell;
    }
  };
  for (const star of layout.stars) {
    // Each star holds still most of the time and flares briefly.
    const cycle = (time / 3.4 + star.phase) % 1;
    const step = cycle < 0.84 ? 0 : Math.floor(((cycle - 0.84) / 0.16) * 4);
    put(star.x, star.y, { glyph: STAR_GLYPHS[step] ?? "·", tone: "star" });
  }
  // Extrusion first, farthest step first, so nearer steps and the digits cover it.
  for (let step = depth; step >= 1; step -= 1) {
    const shade = SHADES[Math.min(step - 1, SHADES.length - 1)] ?? "░";
    for (const [x, y] of layout.pixels) {
      for (let half = 0; half < PIXEL_COLUMNS; half += 1) {
        put(x + half + step * PIXEL_COLUMNS, y + step, {
          glyph: shade,
          tone: "shade",
        });
      }
    }
  }
  const scanRow =
    MARGIN_Y + Math.floor(((time / SCAN_SECONDS) % 1.6) * DIGIT_ROWS);
  for (const [x, y] of layout.pixels) {
    for (let half = 0; half < PIXEL_COLUMNS; half += 1) {
      put(x + half, y, {
        glyph: y === scanRow ? "▓" : glyph,
        tone: y === scanRow ? "scan" : "digit",
      });
    }
  }
  return grid;
};

/** A row as runs of one tone, so each run is one coloured span. */
const runsOf = (row: readonly Cell[]) => {
  const runs: { tone: Tone; text: string }[] = [];
  for (const cell of row) {
    const last = runs.at(-1);
    if (last && (last.tone === cell.tone || cell.glyph === " ")) {
      last.text += cell.glyph;
    } else {
      runs.push({ text: cell.glyph, tone: cell.tone });
    }
  }
  return runs;
};

/**
 * A complete 404 block: the code drawn big in a 5x7 bitmap face of full
 * blocks with a shaded extrusion, under a few stars that flare now and
 * then and a scan row that passes down the digits. Below it sit an
 * optional shell line for the failed path, the heading, a sentence and
 * your actions.
 */
export const NotFound = ({
  code = "404",
  title = "Page not found",
  description = "The page you asked for has moved, or it never existed.",
  path,
  detail = "no such page",
  actions,
  titleAs: Title = "h1",
  glyph = "█",
  depth = 2,
  color = "ink",
  animate = true,
  cell = 14,
  className,
  ...props
}: NotFoundProps) => {
  const steps = Math.min(3, Math.max(0, Math.round(depth)));
  const layout = layoutCode(code, steps);
  const sceneRef = useRef<HTMLPreElement>(null);
  // A still moment between scans: the stars at rest, no row lit.
  const [time, setTime] = useState(SCAN_SECONDS * 1.5);
  useFrameLoop(
    (seconds) => {
      setTime(seconds);
    },
    {
      enabled: animate,
      fps: FPS,
      stillTime: SCAN_SECONDS * 1.5,
      target: sceneRef,
    }
  );
  const grid = drawScene(layout, { depth: steps, glyph, time });
  const ink = cssColor(color);
  const tones: Record<Tone, string | undefined> = {
    blank: undefined,
    digit: ink,
    scan: `color-mix(in oklab, ${ink} 70%, var(--ascii-paper))`,
    shade: `color-mix(in oklab, ${ink} 38%, transparent)`,
    star: "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
  };
  const cursorOn = !animate || Math.floor(time * 1.6) % 2 === 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-6 px-4 py-10 text-center",
        className
      )}
      {...props}
    >
      <pre
        ref={sceneRef}
        aria-hidden="true"
        className="m-0 max-w-full overflow-hidden select-none"
        style={{
          ...SEAL,
          fontFamily: "var(--ascii-font, monospace)",
          fontSize: `${cell / GLYPH_EM}px`,
          fontVariantLigatures: "none",
          letterSpacing: 0,
          lineHeight: `${cell}px`,
        }}
      >
        {grid.map((row, y) => (
          // Rows are positional, top to bottom.
          // oxlint-disable-next-line react/no-array-index-key
          <span key={y} className="block">
            {runsOf(row).map((run, index) => (
              // oxlint-disable-next-line react/no-array-index-key
              <span key={index} style={{ color: tones[run.tone] }}>
                {run.text}
              </span>
            ))}
          </span>
        ))}
      </pre>
      {path ? (
        <p className="text-muted-foreground max-w-full truncate font-mono text-xs">
          <span aria-hidden="true">$ </span>
          {`open ${path}`}
          <span className="sr-only">: </span>
          <span className="block">
            {detail}
            <span
              aria-hidden="true"
              className="text-foreground"
              style={{ opacity: cursorOn ? 1 : 0 }}
            >
              {" ▌"}
            </span>
          </span>
        </p>
      ) : null}
      <div className="flex max-w-md flex-col items-center gap-2">
        <Title className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          {title}
        </Title>
        {description ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
};

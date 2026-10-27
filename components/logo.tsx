import { cn } from "@/lib/utils";

/**
 * The asciicn mark: a `>_` prompt drawn as a 6x6 pixel glyph, the way a
 * terminal font would set it. Each row lists its lit cells; whole rows
 * merge into one rect so the mark has no seams at fractional scales.
 */
const GLYPH = [
  "##....",
  ".##...",
  "..##..",
  ".##...",
  "##....",
  "...###",
] as const satisfies readonly string[];

const CELL = 4;
const SIZE = GLYPH.length * CELL;

interface Run {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Lit cells as horizontal runs, in glyph cells. */
export const LOGO_RUNS: readonly Run[] = GLYPH.flatMap((row, y) =>
  [...row.matchAll(/#+/g)].map((match) => ({
    width: match[0].length,
    x: match.index,
    y,
  }))
);

/** The glyph grid in cells, for callers that draw the runs themselves. */
export const LOGO_CELLS = GLYPH.length;

const rects = (fill: string) =>
  LOGO_RUNS.map(
    ({ x, y, width }) =>
      `<rect x="${x * CELL}" y="${y * CELL}" width="${width * CELL}" height="${CELL}" fill="${fill}"/>`
  ).join("");

export const getLogoMarkSVG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">${rects(color)}</svg>`;

export const LogoMark = ({
  className,
  ...props
}: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${SIZE} ${SIZE}`}
    shapeRendering="crispEdges"
    fill="currentColor"
    aria-hidden="true"
    className={cn("size-4", className)}
    {...props}
  >
    {LOGO_RUNS.map(({ x, y, width }) => (
      <rect
        key={`${x}-${y}`}
        x={x * CELL}
        y={y * CELL}
        width={width * CELL}
        height={CELL}
      />
    ))}
  </svg>
);

export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 font-mono text-[0.9rem] font-medium tracking-tight",
      className
    )}
  >
    <LogoMark className="text-primary size-[18px]" />
    asciicn
  </span>
);

import { cn } from "@/lib/utils";

/**
 * The asciicn mark: one glyph cell. Four corner brackets measure out the
 * 3:5 box every glyph sits in, and the lower half block `▄` waits inside
 * it like a terminal cursor about to draw. The engine's unit of measure,
 * drawn as an icon.
 *
 * Geometry is on a 12 x 20 grid so it stays crisp at 16px and up.
 */
const VIEW_BOX = "0 0 12 20";
const MARKS = [
  [0, 0, 4, 2],
  [0, 0, 2, 5],
  [8, 0, 4, 2],
  [10, 0, 2, 5],
  [0, 18, 4, 2],
  [0, 15, 2, 5],
  [8, 18, 4, 2],
  [10, 15, 2, 5],
] as const satisfies readonly (readonly [
  x: number,
  y: number,
  w: number,
  h: number,
])[];
const BLOCK = { height: 8, width: 6, x: 3, y: 9 } as const;

export const getLogoMarkSVG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" shape-rendering="crispEdges" fill="${color}">${MARKS.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")}<rect x="${BLOCK.x}" y="${BLOCK.y}" width="${BLOCK.width}" height="${BLOCK.height}"/></svg>`;

export const LogoMark = ({
  className,
  ...props
}: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={VIEW_BOX}
    shapeRendering="crispEdges"
    fill="currentColor"
    aria-hidden="true"
    className={cn("h-4 w-auto", className)}
    {...props}
  >
    {MARKS.map(([x, y, w, h]) => (
      <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} />
    ))}
    <rect
      data-slot="logo-fill"
      x={BLOCK.x}
      y={BLOCK.y}
      width={BLOCK.width}
      height={BLOCK.height}
      className="text-ink origin-bottom [transform-box:fill-box]"
      fill="currentColor"
    />
  </svg>
);

/**
 * Mark plus name. On hover of a `group/brand` parent the block rises again
 * in four steps (▁▂▃▄), a cursor charging up.
 */
export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "font-display inline-flex items-center gap-2 text-[15px] leading-none font-medium tracking-[-0.02em] [font-stretch:87.5%]",
      className
    )}
  >
    <LogoMark className="text-foreground h-[18px] group-hover/brand:[&_[data-slot=logo-fill]]:motion-safe:animate-[logo-charge_480ms_steps(4,jump-end)_both]" />
    asciicn
  </span>
);

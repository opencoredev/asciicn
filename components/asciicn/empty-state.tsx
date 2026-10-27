"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cssColor, usePrefersReducedMotion } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

export type EmptyStateIllustration = "inbox" | "search" | "folder" | "cable";

/**
 * Glyph art and a mask of the same size. In the mask, a space is line art,
 * `a` is accent, `s` is the drop shadow, and `1` to `3` are accent glyphs
 * that blink in turn.
 */
export interface EmptyStateArt {
  readonly art: readonly string[];
  readonly mask: readonly string[];
}

/** Line art for the common empty views, drawn in box-drawing glyphs with a `░` drop shadow. */
export const EMPTY_STATE_ART = {
  cable: {
    art: [
      "  ┌─────┐            ┌─────┐  ",
      "  │     ├══          │  ▪  │  ",
      "━━┥     │    ·  ×  · │     ┝━━",
      "  │     ├══          │  ▪  │  ",
      "  └─────┘            └─────┘  ",
    ],
    mask: [
      "                              ",
      "        aaa            a      ",
      "              1  2  3         ",
      "        aaa            a      ",
      "                              ",
    ],
  },
  folder: {
    art: [
      "╭──────╮             ",
      "│      ╰───────────╮ ",
      "├──────────────────┤░",
      "│                  │░",
      "│      ·  ·  ·     │░",
      "│                  │░",
      "╰──────────────────╯░",
      " ░░░░░░░░░░░░░░░░░░░░",
    ],
    mask: [
      "                     ",
      "                     ",
      "aaaaaaaaaaaaaaaaaaaas",
      "                    s",
      "       1  2  3      s",
      "                    s",
      "                    s",
      " ssssssssssssssssssss",
    ],
  },
  inbox: {
    art: [
      "   ·     ·     ·     ",
      "╭──────────────────╮ ",
      "│                  │░",
      "│                  │░",
      "├─────╮      ╭─────┤░",
      "│     ╰──────╯     │░",
      "╰──────────────────╯░",
      " ░░░░░░░░░░░░░░░░░░░░",
    ],
    mask: [
      "   1     2     3     ",
      "                     ",
      "                    s",
      "                    s",
      "      a      a      s",
      "      aaaaaaaa      s",
      "                    s",
      " ssssssssssssssssssss",
    ],
  },
  search: {
    art: [
      "╭───────────╮   ",
      "│ ╱         │░  ",
      "│     ?     │░  ",
      "│           │░  ",
      "╰───────────╯╲  ",
      " ░░░░░░░░░░░░╲╲ ",
      "              ╲╲",
    ],
    mask: [
      "                ",
      "  a          s  ",
      "      1      s  ",
      "             s  ",
      "             a  ",
      " ssssssssssssaa ",
      "              aa",
    ],
  },
} as const satisfies Record<EmptyStateIllustration, EmptyStateArt>;

export interface EmptyStateProps extends Omit<
  ComponentProps<"div">,
  "title" | "color"
> {
  /** Which drawing to show, or your own art and mask. Default `"inbox"`. */
  illustration?: EmptyStateIllustration | EmptyStateArt;
  /** What is empty, such as `"No projects yet"`. */
  title: ReactNode;
  /** One or two sentences on why it is empty and what to do. */
  description?: ReactNode;
  /** Buttons or links that fill the view. */
  action?: ReactNode;
  /** Heading level of the title. Default `"h3"`. */
  titleAs?: "h2" | "h3" | "h4" | "p";
  /** Accent colour of the drawing: a palette name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Blink the accent glyphs. Default true; still under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default 14. */
  cell?: number;
}

const DEFAULT_CELL = 14;
const BLINK_MS = 2400;
/** Delay between the blink of glyph 1, 2 and 3. */
const STAGGER_MS = 360;

type Tone = "line" | "accent" | "shadow" | `blink${1 | 2 | 3}`;

const toneOf = (mark: string): Tone => {
  switch (mark) {
    case "a": {
      return "accent";
    }
    case "s": {
      return "shadow";
    }
    case "1":
    case "2":
    case "3": {
      return `blink${mark}`;
    }
    default: {
      return "line";
    }
  }
};

/** A row cut into runs that share a tone. */
const runsOf = (line: string, mask: string) => {
  const runs: { tone: Tone; text: string }[] = [];
  const glyphs = [...line];
  const marks = [...mask];
  for (const [index, glyph] of glyphs.entries()) {
    const tone = toneOf(marks[index] ?? " ");
    const last = runs.at(-1);
    if (last && last.tone === tone && !tone.startsWith("blink")) {
      last.text += glyph;
    } else {
      runs.push({ text: glyph, tone });
    }
  }
  return runs;
};

const toneStyle = (tone: Tone, accent: string): CSSProperties => {
  if (tone === "line") {
    return { color: "var(--muted-foreground)" };
  }
  if (tone === "shadow") {
    return {
      color: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
    };
  }
  return { color: accent };
};

/**
 * The drawing, as DOM text on the glyph grid. Accent glyphs marked `1` to
 * `3` blink in turn with the Web Animations API, which runs off the main
 * thread and stops under reduced motion.
 */
const Art = ({
  art,
  color,
  animate,
  cell,
}: {
  art: EmptyStateArt;
  color: AsciiColor;
  animate: boolean;
  cell: number;
}) => {
  const ref = useRef<HTMLPreElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || reduced) {
      return;
    }
    const animations = [
      ...el.querySelectorAll<HTMLElement>("[data-blink]"),
    ].map((glyph) =>
      glyph.animate(
        [
          { offset: 0, opacity: 1 },
          { offset: 0.5, opacity: 1 },
          { offset: 0.56, opacity: 0.12 },
          { offset: 0.94, opacity: 0.12 },
          { offset: 1, opacity: 1 },
        ],
        {
          delay: Number(glyph.dataset.blink) * STAGGER_MS,
          duration: BLINK_MS,
          iterations: Number.POSITIVE_INFINITY,
        }
      )
    );
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [animate, reduced, art]);
  const accent = cssColor(color);
  return (
    <pre
      ref={ref}
      aria-hidden="true"
      className="m-0 select-none"
      style={{
        fontFamily: "var(--ascii-font, monospace)",
        fontSize: `${cell / GLYPH_EM}px`,
        fontVariantLigatures: "none",
        letterSpacing: 0,
        lineHeight: `${cell}px`,
      }}
    >
      {art.art.map((line, row) => (
        // Rows are positional, top to bottom.
        // oxlint-disable-next-line react/no-array-index-key
        <span key={row} className="block">
          {runsOf(line, art.mask[row] ?? "").map((run, index) => (
            <span
              // oxlint-disable-next-line react/no-array-index-key
              key={index}
              data-blink={
                run.tone.startsWith("blink") ? run.tone.slice(5) : undefined
              }
              style={toneStyle(run.tone, accent)}
            >
              {run.text}
            </span>
          ))}
        </span>
      ))}
    </pre>
  );
};

/**
 * What to show when a view has nothing in it yet: a small line drawing in
 * box-drawing glyphs (an inbox, a search, a folder or an unplugged cable),
 * a title, a short description and an action. A few accent glyphs blink
 * in turn, so the view feels alive without moving.
 */
export const EmptyState = ({
  illustration = "inbox",
  title,
  description,
  action,
  titleAs: Title = "h3",
  color = "ink",
  animate = true,
  cell = DEFAULT_CELL,
  className,
  ...props
}: EmptyStateProps) => {
  const art =
    typeof illustration === "string"
      ? EMPTY_STATE_ART[illustration]
      : illustration;
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-5 px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      <Art art={art} color={color} animate={animate} cell={cell} />
      <div className="flex max-w-sm flex-col items-center gap-1.5">
        <Title className="text-foreground text-base font-medium text-balance">
          {title}
        </Title>
        {description ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
};

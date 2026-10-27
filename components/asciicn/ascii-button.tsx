"use client";

import { Slot } from "radix-ui";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";

import { BOX, cssColor, SPINNERS, usePrefersReducedMotion } from "@/lib/ascii";
import type { AsciiColor, BoxStyle, SpinnerName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * The button is set in the glyph font on a grid of cells, two rows tall.
 * Its frame is box-drawing text one cell larger than the button on every
 * side, so the lines run through the button's edges, and the label row
 * sits between them. A filled button shows that row in inverse video (a
 * slab of colour with the label knocked out); an outline button inverts
 * on hover. A cursor glyph steps into the cell before the label on hover
 * and focus, as a terminal menu marks its selection. Labels, gaps and
 * icons are whole cells wide, so the frame always closes on the grid.
 */

export const ASCII_BUTTON_VARIANTS = ["filled", "outline", "ghost"] as const;
export type AsciiButtonVariant = (typeof ASCII_BUTTON_VARIANTS)[number];

/** `brackets` draws only the four corners; the rest are `BOX` sets. */
export const ASCII_BUTTON_FRAMES = [
  "rounded",
  "light",
  "heavy",
  "double",
  "ascii",
  "brackets",
] as const;
export type AsciiButtonFrame = (typeof ASCII_BUTTON_FRAMES)[number];

export type AsciiButtonSize = "sm" | "md" | "lg" | "icon";

/** Cell height per size in CSS pixels; the button is two cells tall. */
const CELL = { icon: 16, lg: 20, md: 16, sm: 14 } as const satisfies Record<
  AsciiButtonSize,
  number
>;

/** Long enough for any label; the rest is clipped. */
const RUN = 160;

interface FrameGlyphs {
  readonly tl: string;
  readonly tr: string;
  readonly bl: string;
  readonly br: string;
  readonly h: string;
  readonly v: string;
}

const framesFor = (frame: AsciiButtonFrame): FrameGlyphs =>
  frame === "brackets"
    ? { bl: "└", br: "┘", h: " ", tl: "┌", tr: "┐", v: " " }
    : BOX[frame satisfies BoxStyle];

const STYLES = [
  ".acn-btn-slab{opacity:0;transition:opacity 150ms cubic-bezier(0.23,1,0.32,1)}",
  ".acn-btn[data-variant=filled] .acn-btn-slab{opacity:1}",
  ".acn-btn[data-variant=filled] .acn-btn-label{color:var(--btn-paper)}",
  ".acn-btn-mark{visibility:hidden}",
  ".acn-btn:focus-visible .acn-btn-mark,.acn-btn[data-loading] .acn-btn-mark{visibility:visible}",
  "@media (hover:hover){.acn-btn:hover .acn-btn-mark{visibility:visible}",
  ".acn-btn:not([data-variant=filled]):hover .acn-btn-slab{opacity:1}",
  ".acn-btn:not([data-variant=filled]):hover .acn-btn-label{color:var(--btn-paper)}",
  ".acn-btn[data-variant=filled]:hover .acn-btn-slab{background:color-mix(in oklab,var(--btn-ink) 86%,var(--btn-paper))}}",
  ".acn-btn:active .acn-btn-slab{opacity:1;background:color-mix(in oklab,var(--btn-ink) 78%,black);transition-duration:60ms}",
  ".acn-btn:active .acn-btn-label{color:var(--btn-paper)}",
  ".acn-btn[data-variant=ghost] .acn-btn-frame{opacity:0;transition:opacity 150ms cubic-bezier(0.23,1,0.32,1)}",
  "@media (hover:hover){.acn-btn[data-variant=ghost]:hover .acn-btn-frame{opacity:1}}",
  ".acn-btn[data-variant=ghost]:focus-visible .acn-btn-frame{opacity:1}",
  "@media (prefers-reduced-motion:reduce){.acn-btn-slab,.acn-btn-frame{transition:none!important}}",
].join("");

/** The button's CSS variables: cell height, ink and paper. */
type ButtonVars = CSSProperties &
  Record<"--btn-cell" | "--btn-ink" | "--btn-paper", string>;

const JOIN = "inline-block scale-y-[1.08]";

const Frame = ({ glyphs }: { glyphs: FrameGlyphs }) => {
  const run = glyphs.h.repeat(RUN);
  return (
    <span
      aria-hidden="true"
      className="acn-btn-frame pointer-events-none absolute -inset-y-[calc(var(--btn-cell)/2)] -inset-x-[0.5ch] grid grid-cols-[1ch_minmax(0,1fr)_1ch] grid-rows-3 whitespace-pre text-[var(--btn-ink)] select-none"
    >
      {/* Corners and sides stretch a hair taller than their cell, so the
          vertical strokes overlap and no seam shows between rows. */}
      <span className={JOIN}>{glyphs.tl}</span>
      <span className="overflow-hidden">{run}</span>
      <span className={JOIN}>{glyphs.tr}</span>
      <span className={JOIN}>{glyphs.v}</span>
      <span />
      <span className={JOIN}>{glyphs.v}</span>
      <span className={JOIN}>{glyphs.bl}</span>
      <span className="overflow-hidden">{run}</span>
      <span className={JOIN}>{glyphs.br}</span>
    </span>
  );
};

/** Steps through a spinner's frames; holds the first under reduced motion. */
const Spinner = ({ name }: { name: SpinnerName }) => {
  const frames = SPINNERS[name];
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      return;
    }
    const timer = window.setInterval(
      () => setStep((value) => (value + 1) % frames.length),
      80
    );
    return () => window.clearInterval(timer);
  }, [reduced, frames.length]);
  return <>{frames[step] ?? frames[0]}</>;
};

interface OwnProps {
  /** `filled` is an inverse-video label inside the frame; `outline` inverts on hover; `ghost` shows its frame only on hover and focus. Default `"filled"`. */
  variant?: AsciiButtonVariant;
  /** Box-drawing set for the frame, or `brackets` for corners only. Default `"rounded"`. */
  frame?: AsciiButtonFrame;
  /** A palette name, a CSS variable name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Cell heights of 14, 16 and 20 pixels, so buttons 28, 32 and 40 pixels tall. `icon` fits one icon; give it an `aria-label`. Default `"md"`. */
  size?: AsciiButtonSize;
  /** Glyph shown before the label on hover and focus. Default `"›"`. */
  cursor?: string;
  /** Busy state: a spinner takes the cursor's cell, clicks are ignored and `aria-busy` is set. Default `false`. */
  loading?: boolean;
  /** Which `SPINNERS` sequence spins while loading. Default `"braille"`. */
  spinner?: SpinnerName;
  /** Render your own element (a link) with the button's look, as shadcn's `asChild`. Default `false`. */
  asChild?: boolean;
  children?: ReactNode;
}

export type AsciiButtonProps = OwnProps &
  Omit<ComponentProps<"button">, "children" | "color">;

/**
 * A real `<button>` set in glyphs: a box-drawing frame around a label row
 * that inverts like a terminal selection. Three variants, six frames, four
 * sizes, a spinner from `SPINNERS` while loading, and `asChild` to put the
 * look on a link.
 */
export const AsciiButton = ({
  variant = "filled",
  frame = "rounded",
  color = "ink",
  size = "md",
  cursor = "›",
  loading = false,
  spinner = "braille",
  asChild = false,
  className,
  style,
  children,
  type,
  disabled,
  onClick,
  ...props
}: AsciiButtonProps) => {
  const vars: ButtonVars = {
    "--btn-cell": `${CELL[size]}px`,
    "--btn-ink": cssColor(color),
    "--btn-paper": "var(--ascii-paper)",
  };
  const layers = (label: ReactNode) => (
    <>
      <style href="asciicn-ascii-button" precedence="asciicn">
        {STYLES}
      </style>
      {/* The label row in inverse video: between the frame's sides, one cell tall. */}
      <span
        aria-hidden="true"
        className="acn-btn-slab pointer-events-none absolute inset-x-[0.5ch] top-[calc(var(--btn-cell)/2)] -z-10 h-[var(--btn-cell)] bg-[var(--btn-ink)]"
      />
      <Frame glyphs={framesFor(frame)} />
      <span
        aria-hidden="true"
        className="acn-btn-mark acn-btn-label absolute left-[0.5ch] w-[1ch] text-center"
      >
        {loading ? <Spinner name={spinner} /> : cursor}
      </span>
      <span className="acn-btn-label inline-flex items-center gap-[1ch]">
        {label}
      </span>
    </>
  );
  const rootProps = {
    "aria-busy": loading || undefined,
    "aria-disabled": loading || undefined,
    "data-frame": frame,
    "data-loading": loading ? "" : undefined,
    "data-size": size,
    "data-slot": "button",
    "data-variant": variant,
    ...props,
    className: cn(
      "acn-btn group/button relative isolate inline-flex h-[calc(var(--btn-cell)*2)] shrink-0 cursor-pointer items-center px-[2.5ch] align-middle font-medium whitespace-nowrap text-foreground no-underline select-none",
      "font-[family-name:var(--ascii-font,ui-monospace,monospace)] leading-[var(--btn-cell)] [font-size:calc(var(--btn-cell)/1.2)] [font-variant-ligatures:none]",
      "transition-[scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97]",
      "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring focus-visible:outline-solid",
      "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 data-loading:cursor-progress",
      // Icons take exactly two cells, so the frame still closes on the grid.
      "[&_svg]:pointer-events-none [&_svg]:h-[1.15em] [&_svg]:w-[2ch] [&_svg]:shrink-0",
      className
    ),
    onClick: loading
      ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()
      : onClick,
    style: { ...vars, ...style },
  };

  if (asChild && isValidElement<{ children?: ReactNode }>(children)) {
    // The child (a link) becomes the root; its own content becomes the label.
    return (
      <Slot.Root {...rootProps}>
        {cloneElement(children, undefined, layers(children.props.children))}
      </Slot.Root>
    );
  }
  return (
    <button {...rootProps} type={type ?? "button"} disabled={disabled}>
      {layers(children)}
    </button>
  );
};

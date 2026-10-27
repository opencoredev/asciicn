"use client";

import { useId, useLayoutEffect, useRef } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { BOX, cssColor } from "@/lib/ascii";
import type { AsciiColor, BoxStyle } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * The frame is real box-drawing text in a 3x3 grid: one cell for each
 * corner and side, with the sides as long runs of glyphs clipped to fit.
 * After mount the box measures its content, rounds its own size up to
 * whole cells and pins it, so every glyph of the frame lands on the cell
 * grid and the corners join the sides exactly. Before that (and on the
 * server) the clipped runs still draw a closed frame, so nothing jumps.
 */

/** Frame glyph sets, from `BOX` in the engine. */
export const ASCII_BOX_FRAMES = [
  "light",
  "heavy",
  "double",
  "rounded",
  "ascii",
] as const satisfies readonly BoxStyle[];

export type AsciiBoxFrame = (typeof ASCII_BOX_FRAMES)[number];

/** Shade glyphs for the drop shadow, from light to dark. */
export const ASCII_BOX_SHADOWS = {
  dark: "▓",
  light: "░",
  medium: "▒",
} as const;

export type AsciiBoxShadow = keyof typeof ASCII_BOX_SHADOWS;

export type AsciiBoxLabelAlign = "start" | "center" | "end";

/** Long enough for any side; the overflow is clipped. */
const RUN = 320;

// Glyph cell width per cell height before the font is measured: 0.6em
// advance over a 1.2em line, as `measureCell` assumes.
const FALLBACK_WIDTH = "calc(var(--box-ch) * 0.5)";

export interface AsciiBoxProps extends Omit<ComponentProps<"div">, "title"> {
  /** Box-drawing set for the frame. Default `"light"`. */
  frame?: AsciiBoxFrame;
  /** A label set into the top border, as in `┌─ Title ───┐`. Also names the box for screen readers. */
  title?: ReactNode;
  /** A label set into the bottom border, such as a status or a count. */
  footer?: ReactNode;
  /** Where the labels sit along their border. Default `"start"`. */
  labelAlign?: AsciiBoxLabelAlign;
  /** A shade-glyph drop shadow one cell right and one row down. Default `false` (none). */
  shadow?: boolean | AsciiBoxShadow;
  /** Frame colour: a palette name, a CSS variable name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Space between the frame and the content in rows; columns are doubled so both read the same. Default 1. */
  padding?: number;
  /** Cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
  /** Paint `--ascii-paper` inside the frame, so the box hides what sits behind it. Default `false`. */
  filled?: boolean;
  /** Decoration drawn inside the frame and behind the content, such as `AsciiGlow`. It fills the inner cells. */
  backdrop?: ReactNode;
}

/** The box's CSS variables: cell height, cell width and frame colour. */
type BoxVars = CSSProperties &
  Record<"--box-ch" | "--box-cw" | "--box-ink", string>;

interface Glyphs {
  readonly tl: string;
  readonly tr: string;
  readonly bl: string;
  readonly br: string;
  readonly h: string;
  readonly v: string;
}

/**
 * The content width of the nearest box around the box's wrapper: the most
 * the box may take. `display: contents` ancestors have no box, so skip them.
 */
const roomFor = (wrapper: HTMLElement | null): number => {
  let outer = wrapper?.parentElement ?? null;
  while (outer && getComputedStyle(outer).display === "contents") {
    outer = outer.parentElement;
  }
  if (!outer) {
    return Number.POSITIVE_INFINITY;
  }
  const computed = getComputedStyle(outer);
  return (
    outer.clientWidth -
    (Number.parseFloat(computed.paddingLeft) || 0) -
    (Number.parseFloat(computed.paddingRight) || 0)
  );
};

const verticalRun = (glyph: string) => `${glyph}\n`.repeat(RUN / 4);

const Label = ({
  id,
  glyph,
  align,
  children,
}: {
  id?: string;
  glyph: string;
  align: AsciiBoxLabelAlign;
  children: ReactNode;
}) => {
  const run = glyph.repeat(RUN);
  return (
    <div className="flex min-w-0 overflow-hidden">
      <span
        aria-hidden="true"
        className={cn(
          "overflow-hidden",
          align === "start"
            ? "w-[var(--box-cw)] shrink-0"
            : "min-w-[var(--box-cw)] flex-1"
        )}
      >
        {run}
      </span>
      <span
        id={id}
        data-slot="ascii-box-label"
        className="min-w-0 truncate px-[var(--box-cw)] text-foreground"
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "overflow-hidden",
          align === "end"
            ? "w-[var(--box-cw)] shrink-0"
            : "min-w-[var(--box-cw)] flex-1"
        )}
      >
        {run}
      </span>
    </div>
  );
};

const Edge = ({
  glyph,
  label,
  labelId,
  align,
}: {
  glyph: string;
  label: ReactNode;
  labelId?: string;
  align: AsciiBoxLabelAlign;
}) =>
  label === undefined || label === null || label === false ? (
    <div aria-hidden="true" className="overflow-hidden">
      {glyph.repeat(RUN)}
    </div>
  ) : (
    <Label id={labelId} glyph={glyph} align={align}>
      {label}
    </Label>
  );

/**
 * Wraps any content in a box-drawing frame that sizes to the content on
 * the glyph cell grid: `light`, `heavy`, `double`, `rounded` or `ascii`
 * borders, labels set into the top and bottom borders, and an optional
 * shade-glyph shadow. The primitive the other asciicn interface pieces
 * are built on.
 */
export const AsciiBox = ({
  frame = "light",
  title,
  footer,
  labelAlign = "start",
  shadow = false,
  color = "ink",
  padding = 1,
  cell,
  filled = false,
  backdrop,
  className,
  style,
  children,
  ...props
}: AsciiBoxProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const glyphs: Glyphs = BOX[frame];
  const shade =
    shadow === false
      ? null
      : ASCII_BOX_SHADOWS[shadow === true ? "light" : shadow];
  const hasTitle = title !== undefined && title !== null && title !== false;
  const pad = Math.max(0, padding);

  // Snap the box to whole cells whenever it or its content changes size.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    const probe = probeRef.current;
    if (!(box && content && probe)) {
      return;
    }
    const snap = () => {
      const run = probe.getBoundingClientRect();
      const width = run.width / 10;
      const { height } = run;
      if (!(width > 0 && height > 0)) {
        return;
      }
      box.style.setProperty("--box-cw", `${width}px`);
      // Measure the natural size with nothing pinned, then pin whole cells.
      box.style.width = "";
      box.style.height = "";
      const natural = box.getBoundingClientRect();
      const room = roomFor(box.parentElement) - (shade ? width : 0);
      // Round up, unless that would overflow the parent: then round down.
      let columns = Math.ceil(natural.width / width - 0.01);
      if (columns * width > room + 0.5) {
        columns = Math.max(2, Math.floor(natural.width / width + 0.01));
      }
      const rows = Math.max(2, Math.ceil(natural.height / height - 0.01));
      box.style.width = `${columns * width}px`;
      box.style.height = `${rows * height}px`;
      box.dataset.columns = String(columns);
      box.dataset.rows = String(rows);
    };
    snap();
    const resize = new ResizeObserver(snap);
    resize.observe(content);
    // The wrapper follows its container's width, so it reports when the room changes.
    if (box.parentElement) {
      resize.observe(box.parentElement);
    }
    // Text that grows without changing the content's height still needs a new width.
    const mutations = new MutationObserver(snap);
    mutations.observe(content, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    document.fonts?.addEventListener?.("loadingdone", snap);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", snap);
    };
  }, [shade, cell, pad, frame]);

  const vars: BoxVars = {
    "--box-ch": cell === undefined ? "var(--ascii-cell, 12px)" : `${cell}px`,
    "--box-cw": FALLBACK_WIDTH,
    "--box-ink": cssColor(color),
  };

  return (
    <div
      data-slot="ascii-box"
      role={hasTitle ? "group" : undefined}
      aria-labelledby={hasTitle ? titleId : undefined}
      className={cn(
        "relative w-fit max-w-full",
        shade && "pr-[var(--box-cw)] pb-[var(--box-ch)]",
        className
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      <div
        ref={boxRef}
        data-frame={frame}
        className="relative max-w-full"
        style={{
          padding: `calc(var(--box-ch) * ${1 + pad}) calc(var(--box-cw) * ${1 + pad * 2})`,
        }}
      >
        {filled ? (
          <div
            aria-hidden="true"
            className="absolute inset-[calc(var(--box-ch)/2)_calc(var(--box-cw)/2)] bg-[var(--ascii-paper)]"
          />
        ) : null}
        {backdrop ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[var(--box-ch)_var(--box-cw)] overflow-hidden"
          >
            {backdrop}
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-[var(--box-cw)_minmax(0,1fr)_var(--box-cw)] grid-rows-[var(--box-ch)_minmax(0,1fr)_var(--box-ch)] font-[family-name:var(--ascii-font,ui-monospace,monospace)] text-[var(--box-ink)] whitespace-pre select-none [font-size:calc(var(--box-ch)/1.17)] [font-variant-ligatures:none] leading-[var(--box-ch)]">
          <span aria-hidden="true">{glyphs.tl}</span>
          <Edge
            glyph={glyphs.h}
            label={title}
            labelId={titleId}
            align={labelAlign}
          />
          <span aria-hidden="true">{glyphs.tr}</span>
          <div aria-hidden="true" className="overflow-hidden">
            {verticalRun(glyphs.v)}
          </div>
          <span
            aria-hidden="true"
            ref={probeRef}
            className="invisible absolute top-0 left-0"
          >
            {glyphs.h.repeat(10)}
          </span>
          <div aria-hidden="true" className="col-start-3 overflow-hidden">
            {verticalRun(glyphs.v)}
          </div>
          <span aria-hidden="true">{glyphs.bl}</span>
          <Edge glyph={glyphs.h} label={footer} align={labelAlign} />
          <span aria-hidden="true">{glyphs.br}</span>
        </div>
        <div ref={contentRef} className="relative min-w-0">
          {children}
        </div>
      </div>
      {shade ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[var(--box-ch)] right-0 bottom-0 left-[var(--box-cw)] font-[family-name:var(--ascii-font,ui-monospace,monospace)] text-[var(--box-ink)] whitespace-pre opacity-70 select-none [font-size:calc(var(--box-ch)/1.17)] leading-[var(--box-ch)]"
        >
          <div className="absolute top-0 right-0 bottom-0 w-[var(--box-cw)] overflow-hidden">
            {verticalRun(shade)}
          </div>
          <div className="absolute right-0 bottom-0 left-0 h-[var(--box-ch)] overflow-hidden">
            {shade.repeat(RUN)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

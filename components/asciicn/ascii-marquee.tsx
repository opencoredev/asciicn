"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import {
  BOX,
  cssColor,
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor, BoxStyle } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * Each row is a track of the items repeated end to end, moved by a CSS
 * animation exactly one copy's width and looped, so the seam never shows.
 * After mount the row measures one copy, adds copies until the track is
 * wider than the row, and sets the animation's length and step count so
 * it moves one glyph cell per step (or glides, with `motion="smooth"`).
 * The frame is real box-drawing text: long runs of glyphs clipped to fit,
 * one line per row, so the sides join up on the cell grid.
 */

export const ASCII_MARQUEE_FRAMES = [
  "light",
  "heavy",
  "double",
  "rounded",
  "ascii",
  "none",
] as const satisfies readonly (BoxStyle | "none")[];

export type AsciiMarqueeFrame = (typeof ASCII_MARQUEE_FRAMES)[number];

export const ASCII_MARQUEE_MOTIONS = ["step", "smooth"] as const;
/** `step` moves one glyph cell at a time like an LED board; `smooth` glides. */
export type AsciiMarqueeMotion = (typeof ASCII_MARQUEE_MOTIONS)[number];

export const ASCII_MARQUEE_DIRECTIONS = ["left", "right"] as const;
export type AsciiMarqueeDirection = (typeof ASCII_MARQUEE_DIRECTIONS)[number];

/** A ticker entry: a symbol, an optional price or status, and an optional change in percent. */
export interface AsciiMarqueeQuote {
  /** The symbol or name, drawn in full ink. */
  label: string;
  /** A price, time or status after the label. */
  value?: string;
  /** Change in percent. Positive draws `▲` in `upColor`, negative `▼` in `downColor`. */
  change?: number;
}

/** Plain text, or a quote with a coloured change. */
export type AsciiMarqueeItem = string | AsciiMarqueeQuote;

export interface AsciiMarqueeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "color"
> {
  /** What scrolls past. */
  items: readonly AsciiMarqueeItem[];
  /** A second row under the first, scrolling the other way. Default none. */
  secondRow?: readonly AsciiMarqueeItem[];
  /** Characters per second. Default 8. */
  speed?: number;
  /** Which way the first row moves. Default `"left"`. */
  direction?: AsciiMarqueeDirection;
  /** Whole glyph steps or a smooth glide. Default `"step"`. */
  motion?: AsciiMarqueeMotion;
  /** Hold still while the pointer is over it. Default `true`. */
  pauseOnHover?: boolean;
  /** Box-drawing set for the frame, or `"none"`. Default `"light"`. */
  frame?: AsciiMarqueeFrame;
  /** A label set into the top rule, as in `┌─ NYSE ───┐`. Default none. */
  label?: string;
  /** A label at the right end of the top rule, such as `LIVE`. Default none. */
  status?: string;
  /** The glyph between items. Default `"◆"`. */
  separator?: string;
  /** Glyph cell height in CSS pixels. Default 16. */
  cell?: number;
  /** Frame colour: a palette name, CSS variable name or any CSS colour. Default `"grey"`. */
  frameColor?: AsciiColor;
  /** Colour of rising changes. Default `"green"`. */
  upColor?: AsciiColor;
  /** Colour of falling changes. Default `"red"`. */
  downColor?: AsciiColor;
}

/** Tee glyphs for the rule between two rows, per frame set. */
const TEES = {
  ascii: ["+", "+"],
  double: ["╠", "╣"],
  heavy: ["┣", "┫"],
  light: ["├", "┤"],
  rounded: ["├", "┤"],
} as const satisfies Record<BoxStyle, readonly [string, string]>;

/** Long enough for any rule; the overflow is clipped. */
const RUN = 400;

const STYLES = [
  "@keyframes acn-mq-scroll{to{transform:translateX(calc(-1 * var(--mq-shift)))}}",
  ".acn-mq-track{display:flex;width:max-content}",
  ".acn-mq-row[data-ready] .acn-mq-track{animation:acn-mq-scroll var(--mq-duration) var(--mq-ease) infinite}",
  ".acn-mq-row[data-reverse] .acn-mq-track{animation-direction:reverse}",
  ".acn-mq[data-paused] .acn-mq-track,.acn-mq[data-hover-pause]:hover .acn-mq-track{animation-play-state:paused}",
  "@media (prefers-reduced-motion:reduce){.acn-mq-row .acn-mq-track{animation:none!important}.acn-mq-row{overflow-x:auto!important;scrollbar-width:none}}",
].join("");

type MarqueeVars = CSSProperties & Record<"--mq-cell", string>;

interface Colors {
  readonly up: string;
  readonly down: string;
}

const Item = ({ item, colors }: { item: AsciiMarqueeItem; colors: Colors }) => {
  if (typeof item === "string") {
    return <span>{item}</span>;
  }
  const { label, value, change } = item;
  return (
    <span>
      <span className="font-bold">{label}</span>
      {value === undefined ? null : (
        <span className="opacity-75"> {value}</span>
      )}
      {change === undefined ? null : (
        <span style={{ color: change < 0 ? colors.down : colors.up }}>
          {` ${change < 0 ? "▼" : "▲"}${Math.abs(change).toFixed(2)}%`}
        </span>
      )}
    </span>
  );
};

/** The plain words of an item, for screen readers. */
const spoken = (item: AsciiMarqueeItem): string => {
  if (typeof item === "string") {
    return item;
  }
  const parts = [item.label, item.value ?? ""];
  if (item.change !== undefined) {
    parts.push(
      `${item.change < 0 ? "down" : "up"} ${Math.abs(item.change).toFixed(2)}%`
    );
  }
  return parts.filter(Boolean).join(" ");
};

interface RowProps {
  readonly items: readonly AsciiMarqueeItem[];
  readonly reverse: boolean;
  readonly speed: number;
  readonly motion: AsciiMarqueeMotion;
  readonly separator: string;
  readonly colors: Colors;
}

/** One scrolling line: copies of the items, measured and looped. */
const Row = ({
  items,
  reverse,
  speed,
  motion,
  separator,
  colors,
}: RowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [copies, setCopies] = useState(2);

  const unit = (
    <>
      {items.map((item, index) => (
        // oxlint-disable-next-line no-array-index-key -- items may repeat.
        <span key={index} className="whitespace-pre">
          <Item item={item} colors={colors} />
          {`  ${separator}  `}
        </span>
      ))}
    </>
  );

  // Measure one copy and the row, then size the track and the animation.
  useEffect(() => {
    const row = rowRef.current;
    const first = unitRef.current;
    const probe = probeRef.current;
    if (!(row && first && probe)) {
      return;
    }
    const fit = () => {
      const { width } = first.getBoundingClientRect();
      const glyph = probe.getBoundingClientRect().width / 10;
      if (!(width > 0 && glyph > 0)) {
        return;
      }
      // One copy more than fills the row, so the seam is always offscreen.
      setCopies(Math.max(2, Math.ceil(row.clientWidth / width) + 1));
      const steps = Math.max(1, Math.round(width / glyph));
      row.style.setProperty("--mq-shift", `${width}px`);
      row.style.setProperty(
        "--mq-duration",
        `${(steps / Math.max(0.1, speed)).toFixed(3)}s`
      );
      row.style.setProperty(
        "--mq-ease",
        motion === "step" ? `steps(${steps}, end)` : "linear"
      );
      row.dataset.ready = "";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    observer.observe(first);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [speed, motion]);

  const spares = Array.from({ length: copies - 1 }, (_, index) => index + 1);

  return (
    <div
      ref={rowRef}
      className="acn-mq-row relative min-w-0 overflow-hidden"
      data-reverse={reverse ? "" : undefined}
    >
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute"
      >
        {"0".repeat(10)}
      </span>
      <div className="acn-mq-track">
        <div ref={unitRef} className="flex shrink-0">
          {unit}
        </div>
        {spares.map((copy) => (
          <div key={copy} className="flex shrink-0">
            {unit}
          </div>
        ))}
      </div>
    </div>
  );
};

const Rule = ({
  left,
  glyph,
  right,
  label,
  status,
  ink,
}: {
  left: string;
  glyph: string;
  right: string;
  label?: string;
  status?: string;
  ink: string;
}): ReactNode => (
  <>
    <span className="whitespace-pre" style={{ color: ink }}>
      {left}
      {glyph}
    </span>
    <span className="flex min-w-0 overflow-hidden whitespace-pre">
      {label ? (
        <>
          <span className="shrink-0"> </span>
          {/* The label keeps the text colour; only the rule takes the frame colour. */}
          <span className="shrink-0 font-bold">{label}</span>
          <span className="shrink-0"> </span>
        </>
      ) : null}
      <span className="min-w-0 flex-1 overflow-hidden" style={{ color: ink }}>
        {glyph.repeat(RUN)}
      </span>
      {status ? (
        <span className="shrink-0" style={{ color: ink }}>
          {` ${status} `}
        </span>
      ) : null}
    </span>
    <span className="whitespace-pre" style={{ color: ink }}>
      {glyph}
      {right}
    </span>
  </>
);

/**
 * A scrolling ticker framed in box-drawing rules: items separated by
 * glyph bullets, quotes with coloured `▲` and `▼` changes, an optional
 * second row moving the other way, and a label set into the top rule.
 * It steps one glyph cell at a time like a departure board, loops
 * without a seam and pauses on hover.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiMarquee = ({
  items,
  secondRow,
  speed = 8,
  direction = "left",
  motion = "step",
  pauseOnHover = true,
  frame = "light",
  label,
  status,
  separator = "◆",
  cell = 16,
  frameColor = "grey",
  upColor = "green",
  downColor = "red",
  className,
  style,
  ...props
}: AsciiMarqueeProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const visible = useDocumentVisible();
  const inView = useInView(rootRef);
  const colors: Colors = { down: cssColor(downColor), up: cssColor(upColor) };
  const ink = cssColor(frameColor);
  const box = frame === "none" ? null : BOX[frame];
  const tees = frame === "none" ? null : TEES[frame];
  const rows = secondRow && secondRow.length > 0 ? [items, secondRow] : [items];
  const paused = reduced || !visible || !inView;
  const vars: MarqueeVars = { "--mq-cell": `${cell}px` };

  // A side and one blank cell, so items never touch the frame.
  const side = (glyph: string | undefined, end: boolean): ReactNode =>
    glyph === undefined ? null : (
      <span className="whitespace-pre" style={{ color: ink }}>
        {end ? ` ${glyph}` : `${glyph} `}
      </span>
    );

  const body: ReactNode[] = [];
  for (const [index, rowItems] of rows.entries()) {
    if (index > 0) {
      body.push(
        box && tees ? (
          <div key={`rule-${index}`} className="contents">
            <Rule left={tees[0]} glyph={box.h} right={tees[1]} ink={ink} />
          </div>
        ) : (
          <div key={`rule-${index}`} className="h-[var(--mq-cell)]" />
        )
      );
    }
    body.push(
      <div key={`row-${index}`} className="contents">
        {side(box?.v, false)}
        <Row
          items={rowItems}
          reverse={(direction === "right") !== (index === 1)}
          speed={speed}
          motion={motion}
          separator={separator}
          colors={colors}
        />
        {side(box?.v, true)}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="marquee"
      aria-label={label}
      data-slot="ascii-marquee"
      data-paused={paused ? "" : undefined}
      data-hover-pause={pauseOnHover ? "" : undefined}
      className={cn(
        "acn-mq grid w-full font-[family-name:var(--ascii-font,ui-monospace,monospace)] leading-[var(--mq-cell)] font-normal whitespace-pre [font-size:calc(var(--mq-cell)/1.2)] [font-variant-ligatures:none]",
        box ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-1",
        className
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      <style href="asciicn-ascii-marquee" precedence="asciicn">
        {STYLES}
      </style>
      <ul className="sr-only">
        {[...items, ...(secondRow ?? [])].map((item, index) => (
          // oxlint-disable-next-line no-array-index-key -- items may repeat.
          <li key={index}>{spoken(item)}</li>
        ))}
      </ul>
      {box ? (
        <div aria-hidden="true" className="contents">
          <Rule
            ink={ink}
            left={box.tl}
            glyph={box.h}
            right={box.tr}
            label={label}
            status={status}
          />
        </div>
      ) : null}
      <div aria-hidden="true" className="contents">
        {body}
      </div>
      {box ? (
        <div aria-hidden="true" className="contents">
          <Rule left={box.bl} glyph={box.h} right={box.br} ink={ink} />
        </div>
      ) : null}
    </div>
  );
};

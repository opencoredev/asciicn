"use client";

import { useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { brailleChar, cssColor, SPINNERS, useFrameLoop } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** The states a status dot can show. */
export const STATUS_DOT_STATES = [
  "online",
  "busy",
  "offline",
  "error",
] as const;

export type StatusDotState = (typeof STATUS_DOT_STATES)[number];

/**
 * `dot` draws geometric glyphs (`●`, `◐`, `○`, `✕`), one shape per state so
 * the state reads without colour. `braille` draws one Braille cell per state.
 */
export type StatusDotVariant = "dot" | "braille";

export type StatusDotSize = "sm" | "md" | "lg";

export interface StatusDotProps extends Omit<
  ComponentProps<"span">,
  "children" | "color"
> {
  /** The state to show. Default `"online"`. */
  status?: StatusDotState;
  /** Text next to the glyph and the name screen readers hear. Default: the state, as in `"Online"`. */
  label?: string;
  /** Show the label next to the glyph. When false it is read to screen readers only. Default `true`. */
  showLabel?: boolean;
  /** Glyph family. Default `"dot"`. */
  variant?: StatusDotVariant;
  /** Animate the live states: online pings, busy turns, error flashes. Default `true`. */
  animate?: boolean;
  /** Glyph colour. Default: green, orange, grey or red by state. */
  color?: AsciiColor;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 20px. Default `"md"`. */
  size?: StatusDotSize;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

const CELLS = { lg: 20, md: 16, sm: 12 } as const satisfies Record<
  StatusDotSize,
  number
>;

const COLORS = {
  busy: "orange",
  error: "red",
  offline: "grey",
  online: "green",
} as const satisfies Record<StatusDotState, AsciiColor>;

const LABELS = {
  busy: "Busy",
  error: "Error",
  offline: "Offline",
  online: "Online",
} as const satisfies Record<StatusDotState, string>;

interface Track {
  /** Frames of the animation, in order. The first is the still frame. */
  readonly frames: readonly string[];
  /** Frames per second. */
  readonly rate: number;
}

/** Six Braille dots at rest, all eight for a beat: the online pulse. */
const PULSE = [
  brailleChar(0b0011_0110),
  brailleChar(0b0011_0110),
  brailleChar(0b0011_0110),
  brailleChar(0b1111_1111),
  brailleChar(0b1111_1111),
  brailleChar(0b0011_0110),
] as const;

// Online holds solid, then opens out like a ping and closes again. Error
// flashes between a heavy and a light mark. Offline stays still on purpose.
const TRACKS = {
  braille: {
    busy: { frames: SPINNERS.orbit, rate: 10 },
    error: { frames: ["⣿", "⣿", "⠶", "⠶"], rate: 4 },
    offline: { frames: [brailleChar(0b0010_0100)], rate: 1 },
    online: { frames: PULSE, rate: 8 },
  },
  dot: {
    busy: { frames: ["◐", "◓", "◑", "◒"], rate: 4 },
    error: { frames: ["✕", "✕", "✕", "×"], rate: 4 },
    offline: { frames: ["○"], rate: 1 },
    online: { frames: ["●", "●", "●", "●", "◉", "◎", "◎", "◉"], rate: 6 },
  },
} as const satisfies Record<StatusDotVariant, Record<StatusDotState, Track>>;

/**
 * A status indicator drawn as one glyph: `●` online, `◐` busy, `○`
 * offline and `✕` error, or a Braille cell per state. Online pings, busy
 * turns and error flashes, one glyph swap at a time. The root is a polite
 * live region, so a change of state is read out once.
 */
export const StatusDot = ({
  status = "online",
  label,
  showLabel = true,
  variant = "dot",
  animate = true,
  color,
  size = "md",
  cell,
  className,
  style,
  ...props
}: StatusDotProps) => {
  const glyphRef = useRef<HTMLSpanElement>(null);
  const [tick, setTick] = useState(0);
  const track: Track = TRACKS[variant][status];
  const height = cell ?? CELLS[size];
  const moving = animate && track.frames.length > 1;

  // React draws the glyph, so a new state or variant swaps it cleanly;
  // the loop only sets state when the frame index actually moves.
  useFrameLoop((time) => setTick(Math.floor(time * track.rate)), {
    enabled: moving,
    fps: track.rate * 2,
    target: glyphRef,
  });

  const glyph = track.frames[moving ? tick % track.frames.length : 0] ?? " ";

  const glyphStyle: CSSProperties = {
    color: cssColor(color ?? COLORS[status]),
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / 1.2}px`,
    fontVariantLigatures: "none",
    lineHeight: `${height}px`,
    width: "1ch",
  };

  return (
    <span
      role="status"
      data-slot="status-dot"
      data-status={status}
      className={cn("inline-flex items-center gap-[0.5em]", className)}
      style={style}
      {...props}
    >
      <span
        ref={glyphRef}
        aria-hidden="true"
        className="inline-block shrink-0 text-center whitespace-pre select-none"
        style={glyphStyle}
      >
        {glyph}
      </span>
      <span className={showLabel ? "text-sm text-foreground" : "sr-only"}>
        {label ?? LABELS[status]}
      </span>
    </span>
  );
};

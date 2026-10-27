"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiMedia,
  splitLook,
  useLoadedImage,
} from "@/components/asciicn/ascii-image";
import type { MediaDrawContext } from "@/components/asciicn/ascii-image";
import {
  QUADRANT_GLYPHS,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiHandle,
  AsciiLook,
  Charset,
  MutableFrame,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Which part of the file becomes the logo. `"alpha"` suits SVGs and PNGs
 * on a transparent background; `"dark"` suits a dark logo on a light,
 * opaque background.
 */
export type LogoSource = "alpha" | "dark";

/** One ink for every logo, or each file's own colours. */
export type LogoTone = "mono" | "original";

/**
 * Motion over the logo.
 * - `shimmer`: a diagonal band of solid glyphs sweeps across, again and again.
 * - `scan`: a line runs down the logo and leaves solid glyphs behind it.
 * - `reveal`: the logo assembles from scrambled glyphs, left to right, once.
 */
export const LOGO_EFFECTS = ["none", "shimmer", "scan", "reveal"] as const;
export type LogoEffect = (typeof LOGO_EFFECTS)[number];

export interface AsciiLogoProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** SVG or PNG URL. Cross-origin files need CORS headers. */
  src: string;
  /** The brand name, read by screen readers. `""` hides it. */
  alt: string;
  /** Ink when `tone` is `"mono"`. Default `"ink"`. */
  color?: AsciiColor;
  /** One ink, or the file's own colours. Default `"mono"`. */
  tone?: LogoTone;
  /** Which pixels belong to the logo. Default `"alpha"`. */
  source?: LogoSource;
  /**
   * Cell height in CSS pixels. Default: about a tenth of the logo's
   * height, between 4 and 12.
   */
  cell?: number;
  /** Motion over the logo. Off under reduced motion. Default `"none"`. */
  effect?: LogoEffect;
  /** Seconds per sweep. Default 6. */
  period?: number;
  /** Where in the sweep this logo starts, 0 to 1. Offsets logos in a row. Default 0. */
  phase?: number;
  /** Width over height. Default: the file's own ratio once it loads. */
  ratio?: number;
  /**
   * Load only when the logo nears the viewport. Turn it off inside a
   * clipped, moving row. Default `true`.
   */
  lazy?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/** The densest glyph a charset draws, for solid strokes. */
const solidGlyph = (charset: Charset): string => {
  if (charset.kind === "braille") {
    return "⣿";
  }
  if (charset.kind === "quadrants") {
    return QUADRANT_GLYPHS[15] ?? "█";
  }
  return charset.glyphs.at(-1) ?? "@";
};

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 91.3 + y * 47.7) * 24_634.634;
  return value - Math.floor(value);
};

// Shimmer band width and scan trail, as shares of the logo.
const BAND = 0.14;
const TRAIL = 0.22;

const AUTO_ROWS = 10;

/**
 * A logo redrawn in glyphs. Braille by default, which keeps letterforms
 * crisp at small sizes; `charset="edge"` outlines the shapes with
 * directional strokes instead.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiLogo = (props: AsciiLogoProps) => {
  const [
    look,
    {
      src,
      alt,
      color = "ink",
      tone = "mono",
      source = "alpha",
      cell,
      effect = "none",
      period = 6,
      phase = 0,
      ratio,
      lazy = true,
      handle,
      className,
      style,
      ...rest
    },
  ] = splitLook(props);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { rootMargin: "300px" });
  const [seen, setSeen] = useState(!lazy);
  useEffect(() => {
    if (inView) {
      setSeen(true);
    }
  }, [inView]);
  const image = useLoadedImage(seen ? src : null);
  const reducedMotion = usePrefersReducedMotion();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || cell !== undefined) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(root.clientHeight));
    observer.observe(root);
    return () => observer.disconnect();
  }, [cell]);

  const moving = effect !== "none" && !reducedMotion;
  const autoCell = Math.round(
    Math.min(12, Math.max(4, height / AUTO_ROWS || 8))
  );
  const fileRatio =
    image.status === "ready"
      ? image.source.width / image.source.height
      : undefined;
  const revealStart = useRef({ at: 0, key: "" });

  const finish = (frame: MutableFrame, context: MediaDrawContext) => {
    if (!moving) {
      return;
    }
    const { columns, rows, glyphs } = frame;
    const solid = solidGlyph(context.charset);
    if (effect === "reveal") {
      if (revealStart.current.key !== src) {
        revealStart.current = { at: context.time, key: src };
      }
      const progress = (context.time - revealStart.current.at) / 1.2;
      if (progress >= 1.2) {
        return;
      }
      for (let index = 0; index < glyphs.length; index += 1) {
        const column = index % columns;
        const row = (index - column) / columns;
        const order = column / columns + hash(column, row) * 0.18;
        if (order > progress + 0.1) {
          glyphs[index] = " ";
        } else if (order > progress && glyphs[index] !== " ") {
          glyphs[index] = hash(row, column + progress * 40) > 0.5 ? solid : "·";
        }
      }
      return;
    }
    const cycle = (context.time / Math.max(0.5, period) + phase) % 1;
    for (let index = 0; index < glyphs.length; index += 1) {
      if (glyphs[index] === " ") {
        continue;
      }
      const column = index % columns;
      const row = (index - column) / columns;
      const u = column / Math.max(1, columns);
      const v = row / Math.max(1, rows);
      if (effect === "shimmer") {
        // Runs from off the left edge to off the right, slanted.
        const at = cycle * (1 + BAND * 4) - BAND * 2;
        if (Math.abs(u + (v - 0.5) * 0.35 - at) < BAND / 2) {
          glyphs[index] = solid;
        }
      } else {
        const line = cycle * (1 + TRAIL) - TRAIL / 2;
        const behind = line - v;
        if (behind >= 0 && behind < TRAIL * (1 - hash(column, row) * 0.6)) {
          glyphs[index] = solid;
        }
      }
    }
  };

  const decorative = alt === "";
  const shownRatio = ratio ?? fileRatio;

  return (
    <div
      ref={rootRef}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
      className={cn("relative", className)}
      style={{
        aspectRatio: shownRatio === undefined ? undefined : String(shownRatio),
        ...style,
      }}
      {...rest}
    >
      <AsciiMedia
        {...look}
        charset={look.charset ?? "braille"}
        background={look.background ?? "transparent"}
        colorMode={
          look.colorMode ?? (tone === "original" ? "truecolor" : "mono")
        }
        invert={source === "dark" ? true : look.invert}
        ink={color}
        tone={source === "alpha" ? "alpha" : "luma"}
        autoLevels={source === "dark"}
        fit="contain"
        source={image.status === "ready" ? image.source : null}
        status={image.status}
        placeholder={false}
        cell={cell ?? autoCell}
        animate={moving}
        finish={finish}
        handle={handle}
        className="absolute inset-0"
      />
    </div>
  );
};

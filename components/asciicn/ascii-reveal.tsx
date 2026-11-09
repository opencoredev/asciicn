"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  FocusEvent,
  PointerEvent,
  RefObject,
} from "react";

import {
  AsciiMedia,
  splitLook,
  useLoadedImage,
} from "@/components/asciicn/ascii-image";
import type { MediaDrawContext } from "@/components/asciicn/ascii-image";
import {
  AsciiGrid,
  resolveCharset,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  Charset,
  MutableFrame,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * What starts the reveal.
 * - `view`: once, when the image scrolls into view.
 * - `hover`: on hover or focus, and back to glyphs on leave. A tap toggles it.
 * - `manual`: follows the `revealed` prop.
 */
export const REVEAL_TRIGGERS = ["view", "hover", "manual"] as const;
export type RevealTrigger = (typeof REVEAL_TRIGGERS)[number];

/** Which way the handover edge travels. */
export const REVEAL_DIRECTIONS = [
  "down",
  "up",
  "left",
  "right",
  "radial",
  "random",
] as const;
export type RevealDirection = (typeof REVEAL_DIRECTIONS)[number];

export interface AsciiRevealProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Image URL. Cross-origin files need CORS headers, or the glyphs can't be sampled. */
  src: string;
  /** What the image shows, passed to the `<img>`. `""` marks it decorative. */
  alt: string;
  /** What starts the reveal. Default `"view"`. */
  trigger?: RevealTrigger;
  /** With `trigger="manual"`: show the photo. Default `false`. */
  revealed?: boolean;
  /** Which way the handover edge travels. Default `"down"`. */
  direction?: RevealDirection;
  /** Length of one full sweep in milliseconds. Default 2400. */
  duration?: number;
  /** Default `"standard"`. */
  charset?: AsciiLook["charset"];
  /** Default `"mono"`. */
  colorMode?: AsciiLook["colorMode"];
  /** Colour of the glyphs that scramble at the edge. Default `"orange"`, the amber accent. */
  accent?: AsciiColor;
  /** Width over height of the box. Default: the image's own ratio once it loads, 4/3 before. */
  ratio?: number;
  /** Cell height in CSS pixels. Default 9. */
  cell?: number;
  /** `false` swaps states without a sweep, as reduced motion does. Default `true`. */
  animate?: boolean;
  /** Passed to the image requests. Default `"anonymous"`. */
  crossOrigin?: ComponentProps<"img">["crossOrigin"];
  /** Filled with a handle for export of the glyph layer. */
  handle?: RefObject<AsciiHandle | null>;
}

/**
 * How wide the handover band is, as a share of the sweep. A random
 * dissolve has no single front, so its band runs wider to stay readable.
 */
const BANDS = {
  down: 0.1,
  left: 0.1,
  radial: 0.1,
  random: 0.2,
  right: 0.1,
  up: 0.1,
} as const satisfies Record<RevealDirection, number>;

// A short beat of glyphs before a `view` reveal starts, so it reads as one.
const VIEW_HOLD_MS = 450;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Sine in and out: the edge never rushes, even mid-sweep.
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * clamp01(t))) / 2;

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** Smooth value noise in one dimension, for a front that bends gently. */
const wave = (x: number, seed: number) => {
  const cell = Math.floor(x);
  const t = x - cell;
  const eased = t * t * (3 - 2 * t);
  return hash(cell, seed) * (1 - eased) + hash(cell + 1, seed) * eased;
};

/** Smooth value noise in two dimensions, so a dissolve comes in patches. */
const patches = (x: number, y: number) => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const tx = x - cx;
  const ty = y - cy;
  const ex = tx * tx * (3 - 2 * tx);
  const ey = ty * ty * (3 - 2 * ty);
  const top = hash(cx, cy) * (1 - ex) + hash(cx + 1, cy) * ex;
  const bottom = hash(cx, cy + 1) * (1 - ex) + hash(cx + 1, cy + 1) * ex;
  return top * (1 - ey) + bottom * ey;
};

const popcount = (value: number) => {
  let bits = 0;
  for (let rest = value; rest > 0; rest = Math.floor(rest / 2)) {
    bits += rest % 2;
  }
  return bits;
};

/**
 * How much ink each glyph of a charset carries, 0 to 1. Ramps run from
 * empty to dense by position. Braille and quadrant glyphs are indexed by
 * dot mask, so their ink is the share of dots lit.
 */
const glyphInk = (charset: Charset): ReadonlyMap<string, number> => {
  const ink = new Map<string, number>();
  const { glyphs, kind } = charset;
  const packed = kind === "braille" || kind === "quadrants";
  const dots = kind === "braille" ? 8 : 4;
  for (const [index, glyph] of glyphs.entries()) {
    if (!ink.has(glyph)) {
      ink.set(
        glyph,
        packed ? popcount(index) / dots : index / Math.max(1, glyphs.length - 1)
      );
    }
  }
  return ink;
};

/** A glyph of about `ink` density, varied by `pick` so the edge flickers. */
const scrambleGlyph = (charset: Charset, ink: number, pick: number): string => {
  const { glyphs, kind } = charset;
  if (kind === "braille" || kind === "quadrants") {
    // Light each dot with the cell's ink as its odds.
    const dots = kind === "braille" ? 8 : 4;
    let mask = 0;
    for (let dot = 0; dot < dots; dot += 1) {
      if (hash(pick * 91.7 + dot, dot * 3.1) < ink) {
        mask += 2 ** dot;
      }
    }
    return glyphs[mask] ?? " ";
  }
  const top = glyphs.length - 1;
  const level = Math.round(ink * top + (pick - 0.5) * 4);
  return glyphs[Math.min(top, Math.max(1, level))] ?? " ";
};

/**
 * When each cell hands over, from 0 (first) to 1 (last). Straight sweeps
 * get a gently bent front with a little grain, so cells lock in one by
 * one instead of in ruled lines.
 */
const cellOrder = (
  direction: RevealDirection,
  columns: number,
  rows: number,
  cellWidth: number,
  cellHeight: number,
  out: Float32Array
): void => {
  const halfWidth = (columns * cellWidth) / 2;
  const halfHeight = (rows * cellHeight) / 2;
  const reach = Math.hypot(halfWidth, halfHeight) || 1;
  let low = Infinity;
  let high = -Infinity;
  for (let row = 0; row < rows; row += 1) {
    const v = (row + 0.5) / rows;
    for (let column = 0; column < columns; column += 1) {
      const u = (column + 0.5) / columns;
      const grain = hash(column, row);
      let order = grain;
      if (direction === "down" || direction === "up") {
        const along = direction === "down" ? v : 1 - v;
        order = along * 0.82 + wave(u * 3.2, 7) * 0.11 + grain * 0.07;
      } else if (direction === "left" || direction === "right") {
        const along = direction === "right" ? u : 1 - u;
        order = along * 0.82 + wave(v * 3.2, 11) * 0.11 + grain * 0.07;
      } else if (direction === "radial") {
        const dx = (column + 0.5) * cellWidth - halfWidth;
        const dy = (row + 0.5) * cellHeight - halfHeight;
        order = (Math.hypot(dx, dy) / reach) * 0.86 + grain * 0.14;
      } else {
        order = patches(u * 4.5, v * 4.5) * 0.6 + grain * 0.4;
      }
      out[row * columns + column] = order;
      low = Math.min(low, order);
      high = Math.max(high, order);
    }
  }
  const span = high - low || 1;
  for (let index = 0; index < out.length; index += 1) {
    out[index] = ((out[index] ?? 0) - low) / span;
  }
};

/** Where every cell is in its handover this frame, shared by the layers. */
interface SweepState {
  /** Linear progress of the sweep, 0 (glyphs) to 1 (photo). */
  value: number;
  /** When `value` last advanced, from `performance.now()`. */
  at: number;
  key: string;
  order: Float32Array;
  /** Per cell: at or below 0 still glyphs, 0 to 1 handing over, 1 photo. */
  phase: Float32Array;
  /** Per cell: the ink of the glyph it held, so the edge keeps the picture. */
  ink: Float32Array;
  columns: number;
  rows: number;
  /** One pixel per cell, scaled up to mask the photo. */
  mask: HTMLCanvasElement | null;
}

/**
 * An image that resolves out of glyphs. It starts as the picture in
 * ASCII, sampled from the photo, then cells lock in and hand over to the
 * real image along a sweep. Glyphs scramble in the accent colour at the
 * edge; behind it the photo shows, ahead of it the glyphs hold.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiReveal = (props: AsciiRevealProps) => {
  const [
    look,
    {
      src,
      alt,
      trigger = "view",
      revealed = false,
      direction = "down",
      duration = 2400,
      accent = "orange",
      ratio,
      cell = 9,
      animate = true,
      crossOrigin = "anonymous",
      handle,
      className,
      style,
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onFocus,
      onBlur,
      ...rest
    },
  ] = splitLook(props);
  const charset = look.charset ?? "standard";
  const colorMode = look.colorMode ?? "mono";
  const resolved = resolveCharset(charset, look.chars);
  const inkMap = useMemo(
    () => glyphInk(resolveCharset(charset, look.chars)),
    [charset, look.chars]
  );
  const reducedMotion = usePrefersReducedMotion();
  const still = reducedMotion || !animate;

  const rootRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLCanvasElement>(null);
  const sweepRef = useRef<SweepState>({
    at: 0,
    columns: 0,
    ink: new Float32Array(0),
    key: "",
    mask: null,
    order: new Float32Array(0),
    phase: new Float32Array(0),
    rows: 0,
    value: 0,
  });

  // Load the photo for sampling only once the box is near the viewport.
  const near = useInView(rootRef, { rootMargin: "320px" });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (near) {
      setArmed(true);
    }
  }, [near]);
  const image = useLoadedImage(armed ? src : null, crossOrigin);
  const ready = image.status === "ready";

  // `view`: reveal once, when enough of the box is on screen.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (trigger !== "view" || !root || seen) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }
        const tall = entry.intersectionRect.height >= window.innerHeight * 0.5;
        if (entry.intersectionRatio >= 0.35 || tall) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.2, 0.35, 0.5] }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [trigger, seen]);

  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!(trigger === "view" && seen && ready) || still) {
      setHeld(false);
      return;
    }
    const timer = window.setTimeout(() => setHeld(true), VIEW_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [trigger, seen, ready, still]);

  let wanted = false;
  if (trigger === "manual") {
    wanted = revealed;
  } else if (trigger === "hover") {
    wanted = hovered;
  } else {
    // Under reduced motion a `view` reveal shows its final state outright.
    wanted = still || held;
  }
  const target = ready && wanted ? 1 : 0;

  const [moving, setMoving] = useState(false);
  // Where the sweep last came to rest. The <img> shows only at rest on 1.
  const [restingAt, setRestingAt] = useState(0);
  useEffect(() => {
    const sweep = sweepRef.current;
    if (still) {
      sweep.value = target;
      setMoving(false);
      setRestingAt(target);
      return;
    }
    if (sweep.value !== target) {
      sweep.at = performance.now();
      setMoving(true);
    }
  }, [target, still]);

  /** Step the sweep towards the target. Safe to call twice in a frame. */
  const advance = () => {
    const sweep = sweepRef.current;
    const now = performance.now();
    if (still) {
      sweep.value = target;
    } else {
      const elapsed = Math.min(100, Math.max(0, now - sweep.at));
      const step = elapsed / Math.max(1, duration);
      sweep.value =
        target > sweep.value
          ? Math.min(target, sweep.value + step)
          : Math.max(target, sweep.value - step);
    }
    sweep.at = now;
    return sweep;
  };

  /** Draw the photo through a one-pixel-per-cell mask of the handed-over cells. */
  const paintPhoto = (sweep: SweepState, context: MediaDrawContext) => {
    const canvas = photoRef.current;
    const drawable = canvas?.getContext("2d");
    if (!(canvas && drawable && image.status === "ready")) {
      return;
    }
    const { metrics, box, columns, rows } = context;
    const width = Math.max(1, Math.round(box.width * metrics.dpr));
    const height = Math.max(1, Math.round(box.height * metrics.dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawable.globalCompositeOperation = "source-over";
    drawable.clearRect(0, 0, width, height);
    if (sweep.value <= 0) {
      return;
    }
    // Cover the box, centred, the way the <img> does with object-fit.
    const { source } = image;
    const scale = Math.max(width / source.width, height / source.height);
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    drawable.imageSmoothingEnabled = true;
    drawable.imageSmoothingQuality = "high";
    drawable.drawImage(
      source.element,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    if (sweep.value >= 1) {
      return;
    }
    // One extra column and row cover the strip past the last whole cell.
    const maskWidth = columns + 1;
    const maskHeight = rows + 1;
    const mask = sweep.mask ?? document.createElement("canvas");
    sweep.mask = mask;
    if (mask.width !== maskWidth || mask.height !== maskHeight) {
      mask.width = maskWidth;
      mask.height = maskHeight;
    }
    const maskContext = mask.getContext("2d");
    if (!maskContext) {
      return;
    }
    const pixels = maskContext.createImageData(maskWidth, maskHeight);
    for (let row = 0; row < maskHeight; row += 1) {
      const sourceRow = Math.min(row, rows - 1);
      for (let column = 0; column < maskWidth; column += 1) {
        const sourceColumn = Math.min(column, columns - 1);
        const phase = sweep.phase[sourceRow * columns + sourceColumn] ?? 0;
        pixels.data[(row * maskWidth + column) * 4 + 3] = Math.round(
          smoothstep(0.45, 0.95, phase) * 255
        );
      }
    }
    maskContext.putImageData(pixels, 0, 0);
    drawable.globalCompositeOperation = "destination-in";
    // A smoothed mask softens the photo's edge by about a cell, so the
    // handover reads as glyphs dissolving, not as square pixels.
    drawable.imageSmoothingEnabled = true;
    drawable.drawImage(
      mask,
      0,
      0,
      maskWidth * metrics.deviceWidth,
      maskHeight * metrics.deviceHeight
    );
    drawable.globalCompositeOperation = "source-over";
  };

  // Glyphs ahead of the edge hold; at and behind it they clear for the photo.
  const finish = (frame: MutableFrame, context: MediaDrawContext) => {
    const sweep = advance();
    const { columns, rows, metrics } = context;
    const size = columns * rows;
    const key = [direction, columns, rows, metrics.width, metrics.height].join(
      "|"
    );
    if (sweep.key !== key) {
      sweep.key = key;
      sweep.order = new Float32Array(size);
      sweep.phase = new Float32Array(size);
      sweep.ink = new Float32Array(size);
      sweep.columns = columns;
      sweep.rows = rows;
      cellOrder(
        direction,
        columns,
        rows,
        metrics.width,
        metrics.height,
        sweep.order
      );
    }
    const band = BANDS[direction];
    const front = easeInOut(sweep.value) * (1 + band);
    const { order, phase, value } = sweep;
    for (let index = 0; index < size; index += 1) {
      let cellPhase = value >= 1 ? 1 : 0;
      if (value > 0 && value < 1) {
        cellPhase = (front - (order[index] ?? 0)) / band;
      }
      phase[index] = cellPhase;
      if (cellPhase > 0) {
        if (cellPhase < 1) {
          sweep.ink[index] = inkMap.get(frame.glyphs[index] ?? " ") ?? 0.6;
        }
        frame.glyphs[index] = " ";
      }
    }
    paintPhoto(sweep, context);
    if (value === target) {
      setMoving(false);
      setRestingAt(target);
    }
  };

  // The edge: cells mid-handover flicker through glyphs in the accent
  // colour, about as dense as the glyph they held, thinning as they lock in.
  const drawEdge = ({ frame, columns, rows }: AsciiGridDrawContext) => {
    const sweep = sweepRef.current;
    if (
      sweep.columns !== columns ||
      sweep.rows !== rows ||
      sweep.value <= 0 ||
      sweep.value >= 1
    ) {
      return;
    }
    // A new glyph about every 80ms reads as a flicker, not as noise.
    const tick = Math.floor(performance.now() / 80);
    for (let index = 0; index < sweep.phase.length; index += 1) {
      const phase = sweep.phase[index] ?? 0;
      if (phase <= 0 || phase >= 0.85) {
        continue;
      }
      const ink = sweep.ink[index] ?? 0;
      if (ink <= 0) {
        continue;
      }
      const pick = hash(index * 0.37 + tick * 1.7, tick * 0.13);
      const fade = 1 - smoothstep(0.15, 0.85, phase) * 0.75;
      frame.glyphs[index] = scrambleGlyph(resolved, ink * fade, pick);
    }
  };

  /* Hover and focus -------------------------------------------------------- */

  const hover = trigger === "hover";
  const handleEnter = (event: PointerEvent<HTMLDivElement>) => {
    onPointerEnter?.(event);
    if (hover && event.pointerType === "mouse") {
      setHovered(true);
    }
  };
  const handleLeave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    if (hover && event.pointerType === "mouse") {
      setHovered(false);
    }
  };
  // Touch has no hover, so a tap toggles the photo.
  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (hover && event.pointerType !== "mouse") {
      setHovered((value) => !value);
    }
  };
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (hover) {
      setHovered(true);
    }
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    const next = event.relatedTarget;
    if (
      hover &&
      !(next instanceof Node && event.currentTarget.contains(next))
    ) {
      setHovered(false);
    }
  };

  const natural = ready
    ? image.source.width / Math.max(1, image.source.height)
    : undefined;
  const boxRatio = ratio ?? natural ?? 4 / 3;
  const showImage = ready && target === 1 && restingAt === 1 && !moving;
  let state = "glyphs";
  if (showImage) {
    state = "photo";
  } else if (moving) {
    state = "revealing";
  }

  return (
    <div
      ref={rootRef}
      data-status={image.status}
      data-state={state}
      tabIndex={hover ? 0 : undefined}
      className={cn(
        "group/reveal relative aspect-(--reveal-ratio) overflow-hidden",
        hover && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      style={{ "--reveal-ratio": `${boxRatio}`, ...style } as CSSProperties}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onPointerDown={handleDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      <AsciiMedia
        {...look}
        charset={charset}
        colorMode={colorMode}
        source={ready ? image.source : null}
        status={image.status}
        cell={cell}
        animate={moving}
        finish={finish}
        handle={handle}
        className="absolute inset-0"
      />
      <canvas
        ref={photoRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <AsciiGrid
        draw={drawEdge}
        cell={cell}
        ink={accent}
        animate={moving}
        className="absolute inset-0"
      />
      {/* oxlint-disable-next-line nextjs/no-img-element -- the photo must be the exact file the glyphs were sampled from. */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        crossOrigin={crossOrigin}
        draggable={false}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover",
          showImage ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
};

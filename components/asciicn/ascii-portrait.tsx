"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from "react";

import {
  AsciiMedia,
  splitLook,
  useLoadedImage,
} from "@/components/asciicn/ascii-image";
import type {
  MediaDrawContext,
  MediaFit,
} from "@/components/asciicn/ascii-image";
import { edgeChar, resolveCharset, usePrefersReducedMotion } from "@/lib/ascii";
import type {
  AsciiHandle,
  AsciiLook,
  CharsetKind,
  Grade,
  MutableFrame,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * How the visitor opens the before/after split.
 * - `hover`: the photo shows left of the pointer while it is over the
 *   portrait, and slides away when it leaves.
 * - `drag`: the split stays where it was dragged, starting at half.
 * - `none`: no split.
 */
export const PORTRAIT_COMPARES = ["hover", "drag", "none"] as const;
export type PortraitCompare = (typeof PORTRAIT_COMPARES)[number];

export interface AsciiPortraitProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Photo URL. Cross-origin files need CORS headers. */
  src: string;
  /** Who the portrait shows, read by screen readers. `""` marks it decorative. */
  alt: string;
  /** Default `"braille"`: 2x4 dots per cell, the finest detail at a given cell. */
  charset?: AsciiLook["charset"];
  /** Default `"mono"`. */
  colorMode?: AsciiLook["colorMode"];
  /** Tone grading. Default `{ contrast: 1.2, gamma: 0.9 }`, tuned for skin and shadow. */
  grade?: Grade;
  /** Sharpen features before glyphs are chosen, 0 to 1. Default 0.5. */
  detail?: number;
  /** Draw Sobel contour strokes over the tones. Default `true`. */
  edges?: boolean;
  /** How strong a contour must be to draw a stroke, 0 to 1. Default 0.16 for Braille and quadrants, 0.22 for `edge`, 0.3 for ramps. */
  edgeThreshold?: number;
  /** The portrait develops from its outline to full tone on mount. Default `true`. */
  develop?: boolean;
  /** Length of the develop reveal in milliseconds. Default 2600. */
  developDuration?: number;
  /** Before/after split that shows the source photo. Default `"hover"`. */
  compare?: PortraitCompare;
  /** How the photo fills its box. Default `"cover"`. */
  fit?: MediaFit;
  /** Photo position when it overflows, 0 to 1 per axis. Default `[0.5, 0.3]`, towards the eyes. */
  focus?: readonly [number, number];
  /** Stretch the photo's tones to use the whole ramp. Default `true`. */
  autoLevels?: boolean;
  /** Cell height in CSS pixels. Default 8. */
  cell?: number;
  /** `false` skips the develop reveal. Default `true`. */
  animate?: boolean;
  /** Passed to the image request. Default `"anonymous"`. */
  crossOrigin?: ComponentProps<"img">["crossOrigin"];
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const PORTRAIT_GRADE: Grade = { contrast: 1.2, gamma: 0.9 };

/**
 * Default contour bar per charset kind. A ramp cell spans eight Braille
 * samples, so its gradients run stronger and it needs a higher bar to
 * keep strokes sparse. `edge` keeps the engine's own default.
 */
const EDGE_THRESHOLDS = {
  braille: 0.16,
  edge: 0.22,
  quadrants: 0.16,
  ramp: 0.3,
} as const satisfies Record<CharsetKind, number>;
const EYE_LINE = [0.5, 0.3] as const;

/* -------------------------------------------------------------------------- */
/* Tone shaping: sharpen, find contours, develop                              */
/* -------------------------------------------------------------------------- */

interface Scratch {
  /** Sharpened tones. */
  sharp: Float32Array;
  /** A blur of the source tones, then reused as the blur behind the Sobel. */
  soft: Float32Array;
  temp: Float32Array;
  /** Sobel gradient per sample, kept so ramp strokes point the right way. */
  gx: Float32Array;
  gy: Float32Array;
  /** 1 where a thinned contour runs. */
  edge: Uint8Array;
  /** A fixed random value per sample, so the develop grain doesn't crawl. */
  grain: Float32Array;
}

const makeScratch = (size: number): Scratch => {
  const grain = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    const value = Math.sin(index * 12.9898 + 78.233) * 43_758.5453;
    grain[index] = value - Math.floor(value);
  }
  return {
    edge: new Uint8Array(size),
    grain,
    gx: new Float32Array(size),
    gy: new Float32Array(size),
    sharp: new Float32Array(size),
    soft: new Float32Array(size),
    temp: new Float32Array(size),
  };
};

/** A separable box blur of `radius` samples, clamped at the borders. */
const boxBlur = (
  source: ArrayLike<number>,
  out: Float32Array,
  temp: Float32Array,
  width: number,
  height: number,
  radius: number
): void => {
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum += source[row + Math.min(width - 1, Math.max(0, x + k))] ?? 0;
      }
      temp[row + x] = sum / span;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum += temp[Math.min(height - 1, Math.max(0, y + k)) * width + x] ?? 0;
      }
      out[y * width + x] = sum / span;
    }
  }
};

/**
 * Sobel on the softened tones, then non-maximum suppression: a sample
 * keeps its contour only where it is the peak across the gradient, so
 * strokes come out one sample wide instead of as soft bands.
 */
const findContours = (
  scratch: Scratch,
  width: number,
  height: number,
  threshold: number
): void => {
  const { soft, gx, gy, edge, temp } = scratch;
  const at = (x: number, y: number) =>
    soft[
      Math.min(height - 1, Math.max(0, y)) * width +
        Math.min(width - 1, Math.max(0, x))
    ] ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const sy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      const index = y * width + x;
      gx[index] = sx;
      gy[index] = sy;
      temp[index] = Math.hypot(sx, sy) / 4;
    }
  }
  const magnitude = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height
      ? 0
      : (temp[y * width + x] ?? 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = temp[index] ?? 0;
      if (value <= threshold) {
        edge[index] = 0;
        continue;
      }
      // Step one sample along the gradient, snapped to 8 directions.
      const angle = Math.atan2(gy[index] ?? 0, gx[index] ?? 0);
      const dx = Math.round(Math.cos(angle));
      const dy = Math.round(Math.sin(angle));
      const peak =
        value >= magnitude(x + dx, y + dy) && value > magnitude(x - dx, y - dy);
      edge[index] = peak ? 1 : 0;
    }
  }
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/* -------------------------------------------------------------------------- */
/* AsciiPortrait                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A face redrawn in fine glyphs: Braille by default, graded and sharpened
 * for skin and shadow, with contour strokes over the tones. It develops
 * from outline to full tone on mount, and a split shows the photo beside
 * the glyphs.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiPortrait = (props: AsciiPortraitProps) => {
  const [
    look,
    {
      src,
      alt,
      detail = 0.5,
      edges = true,
      develop = true,
      developDuration = 2600,
      compare = "hover",
      fit = "cover",
      focus = EYE_LINE,
      autoLevels = true,
      cell = 8,
      animate = true,
      crossOrigin = "anonymous",
      handle,
      className,
      style,
      ...rest
    },
  ] = splitLook(props);
  const charset = look.charset ?? "braille";
  const edgeThreshold =
    look.edgeThreshold ??
    EDGE_THRESHOLDS[resolveCharset(charset, look.chars).kind];
  const image = useLoadedImage(src, crossOrigin);
  const reducedMotion = usePrefersReducedMotion();
  const playDevelop = develop && animate && !reducedMotion;

  const rootRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<Scratch | null>(null);
  const developRef = useRef({ at: 0, key: "" });
  const [developing, setDeveloping] = useState(false);
  // Split position as a fraction of the width; `open` shows the photo at all.
  const [split, setSplit] = useState({ at: 0.5, open: compare === "drag" });
  const [dragging, setDragging] = useState(false);

  // Keep the loop running for the reveal, then let the portrait rest.
  useEffect(() => {
    if (image.status !== "ready" || !playDevelop) {
      setDeveloping(false);
      return;
    }
    setDeveloping(true);
    const timer = window.setTimeout(
      () => setDeveloping(false),
      developDuration + 150
    );
    return () => window.clearTimeout(timer);
  }, [image.status, playDevelop, developDuration, src]);

  useEffect(() => {
    setSplit({ at: 0.5, open: compare === "drag" });
  }, [compare]);

  const shape = (field: ToneField, context: MediaDrawContext) => {
    const { width, height, tones } = field;
    const size = width * height;
    if (scratchRef.current?.sharp.length !== size) {
      scratchRef.current = makeScratch(size);
    }
    const scratch = scratchRef.current;
    const { sharp, soft, temp, edge, grain } = scratch;
    const packed = context.charset.kind !== "ramp";
    // Detail is relative to a cell, so the blur spans about one cell.
    const [cellX] = context.charset.grid;

    // Unsharp mask: lift each sample away from its neighbourhood.
    boxBlur(tones, soft, temp, width, height, Math.max(1, cellX));
    const amount = clamp01(detail) * 1.6;
    for (let index = 0; index < size; index += 1) {
      const tone = tones[index] ?? 0;
      sharp[index] = clamp01(tone + (tone - (soft[index] ?? 0)) * amount);
    }

    const contours = edges && context.charset.kind !== "edge";
    if (contours) {
      boxBlur(tones, soft, temp, width, height, packed ? 1 : 0);
      findContours(scratch, width, height, edgeThreshold);
    }

    // The develop clock starts on the first frame drawn from this photo.
    if (developRef.current.key !== src) {
      developRef.current = { at: performance.now(), key: src };
    }
    const progress = playDevelop
      ? (performance.now() - developRef.current.at) / developDuration
      : 1;
    // Outline first, like a sketch, then the tones rise through it.
    const lines = smoothstep(0, 0.4, progress);
    const rise = easeOutCubic((progress - 0.15) / 0.85);
    for (let index = 0; index < size; index += 1) {
      const tone = sharp[index] ?? 0;
      const seed = grain[index] ?? 0;
      let value = tone;
      if (rise < 1) {
        const front = 1.35 - rise * 1.35;
        value = tone * smoothstep(front - 0.35, front, tone + seed * 0.25);
      }
      if (contours && packed && edge[index] === 1 && seed < lines) {
        value = 1;
      }
      tones[index] = value;
    }
  };

  // Ramp charsets get their strokes as `- / | \` glyphs, one per cell.
  const finish = (frame: MutableFrame, context: MediaDrawContext) => {
    const scratch = scratchRef.current;
    if (
      !(edges && scratch) ||
      context.charset.kind !== "ramp" ||
      scratch.edge.length !== frame.glyphs.length
    ) {
      return;
    }
    const progress = playDevelop
      ? (performance.now() - developRef.current.at) / developDuration
      : 1;
    const lines = smoothstep(0, 0.4, progress);
    const { edge, gx, gy, grain } = scratch;
    for (let index = 0; index < edge.length; index += 1) {
      if (edge[index] === 1 && (grain[index] ?? 0) < lines) {
        frame.glyphs[index] = edgeChar(gx[index] ?? 0, gy[index] ?? 0);
      }
    }
  };

  /* Before/after split ----------------------------------------------------- */

  const splitAt = (clientX: number) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) {
      return 0.5;
    }
    return clamp01((clientX - box.left) / box.width);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (compare === "hover" && event.pointerType === "mouse") {
      setSplit({ at: splitAt(event.clientX), open: true });
    } else if (dragging) {
      setSplit({ at: splitAt(event.clientX), open: true });
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (compare === "none") {
      return;
    }
    // Capture keeps the drag going past the edge. It throws if the pointer
    // is already gone (a very short tap), and the gesture works without it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture.
    }
    setDragging(true);
    setSplit({ at: splitAt(event.clientX), open: true });
  };
  const onPointerUp = () => {
    setDragging(false);
  };
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (compare === "hover" && !dragging && event.pointerType === "mouse") {
      setSplit((value) => ({ ...value, open: false }));
    }
  };
  const onBlur = () => {
    if (compare === "hover") {
      setSplit((value) => ({ ...value, open: false }));
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      End: 1,
      Home: -1,
    };
    const move = moves[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    setSplit((value) => ({ at: clamp01(value.at + move), open: true }));
  };

  const decorative = alt === "";
  const ready = image.status === "ready";
  const showSplit = compare !== "none" && ready;
  const percent = `${(split.at * 100).toFixed(2)}%`;
  const objectPosition = `${focus[0] * 100}% ${focus[1] * 100}%`;

  return (
    <div
      ref={rootRef}
      data-status={image.status}
      data-split={showSplit && split.open ? "open" : "closed"}
      className={cn(
        "group/portrait relative overflow-hidden select-none",
        showSplit && "cursor-ew-resize touch-pan-y",
        className
      )}
      style={{ "--split": percent, ...style } as CSSProperties}
      onPointerMove={showSplit ? onPointerMove : undefined}
      onPointerDown={showSplit ? onPointerDown : undefined}
      onPointerUp={showSplit ? onPointerUp : undefined}
      onPointerCancel={showSplit ? onPointerUp : undefined}
      onPointerLeave={showSplit ? onPointerLeave : undefined}
      {...rest}
    >
      {/* The picture is a sibling of the split handle, so the handle stays reachable. */}
      {decorative ? null : (
        <div role="img" aria-label={alt} className="absolute inset-0" />
      )}
      <AsciiMedia
        {...look}
        charset={charset}
        colorMode={look.colorMode ?? "mono"}
        grade={look.grade ?? PORTRAIT_GRADE}
        edgeThreshold={edgeThreshold}
        source={ready ? image.source : null}
        status={image.status}
        message="portrait unavailable"
        fit={fit}
        focus={focus}
        autoLevels={autoLevels}
        cell={cell}
        animate={animate && (developing || image.status === "loading")}
        shape={shape}
        finish={finish}
        handle={handle}
        className="absolute inset-0"
      />
      {showSplit ? (
        <>
          {/* oxlint-disable-next-line nextjs/no-img-element -- the photo beside the glyphs must be the exact file that was sampled. */}
          <img
            src={src}
            alt=""
            aria-hidden
            crossOrigin={crossOrigin}
            draggable={false}
            className={cn(
              "pointer-events-none absolute inset-0 size-full",
              // Follow the pointer exactly; ease only when the split closes.
              split.open
                ? "[clip-path:inset(0_calc(100%-var(--split))_0_0)]"
                : "transition-[clip-path] duration-300 ease-out [clip-path:inset(0_100%_0_0)] motion-reduce:transition-none"
            )}
            style={{ objectFit: fit, objectPosition }}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-label="Photo and glyph split"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(split.open ? split.at * 100 : 0)}
            aria-valuetext={
              split.open
                ? `photo on the left ${Math.round(split.at * 100)}%`
                : "glyphs only"
            }
            onKeyDown={onKeyDown}
            onFocus={() => setSplit((value) => ({ ...value, open: true }))}
            onBlur={onBlur}
            className={cn(
              "absolute inset-y-0 w-px -translate-x-1/2 bg-[var(--ascii-ink)] outline-none",
              "before:absolute before:inset-y-0 before:-left-3 before:-right-3 before:content-['']",
              "focus-visible:ring-2 focus-visible:ring-ring",
              split.open
                ? "left-[var(--split)] opacity-100"
                : "left-0 opacity-0 transition-[left,opacity] duration-300 ease-out motion-reduce:transition-none"
            )}
          >
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[var(--ascii-ink)] bg-[var(--ascii-paper)] px-1 font-mono text-[11px] leading-4 text-[var(--ascii-ink)]">
              ◂▸
            </span>
            <span className="absolute top-2 right-2 bg-[var(--ascii-paper)]/80 px-1 font-mono text-[10px] leading-4 text-[var(--ascii-ink)]">
              photo
            </span>
            <span className="absolute top-2 left-2 bg-[var(--ascii-paper)]/80 px-1 font-mono text-[10px] leading-4 text-[var(--ascii-ink)]">
              glyphs
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
};

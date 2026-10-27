"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from "react";

import {
  brailleChar,
  createToneField,
  cssColor,
  LINE_HEIGHT,
  mapTones,
  measureCell,
  readFont,
  resolveCharset,
  rgbToHex,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  Charset,
  CharsetName,
  DitherMatrix,
  RampName,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

export const ASCII_TEXT_REVEALS = ["none", "decode", "scan", "wipe"] as const;
/**
 * How the art appears: `decode` cycles every inked cell through random
 * glyphs until it settles, `scan` writes rows from the top behind a bright
 * line, `wipe` writes columns from the left behind a ragged edge.
 */
export type AsciiTextReveal = (typeof ASCII_TEXT_REVEALS)[number];

export type AsciiTextTrigger = "mount" | "view" | "hover";

export type AsciiTextTag = "h1" | "h2" | "h3" | "h4" | "p" | "div" | "span";

export interface AsciiTextProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /** The text to draw. Line breaks start new lines. */
  children: string;
  /** The element that holds the real text. Default `"h2"`. */
  as?: AsciiTextTag;
  /** Font size the type is drawn at, in CSS pixels, before sampling into cells. Default 96. */
  size?: number;
  /** Glyph cell height in CSS pixels. Smaller cells draw finer type. Default 8. */
  cell?: number;
  /** Glyphs the type is drawn with. `braille` gives smooth large type, `blocks` chunky banners, `edge` outlines. Default `"braille"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .oO@"`. Wins over `charset`. */
  chars?: string;
  /** `mono` draws every glyph in `color`; `duotone` colours glyphs by density along `ramp`. Default `"mono"`. */
  colorMode?: "mono" | "duotone";
  /** `duotone`: a ramp name. Default `"mainframe"`. */
  ramp?: RampName;
  /** `mono`: glyph colour, a palette name, CSS variable name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Braille and quadrants: the coverage that lights a dot, 0 to 1. Default 0.5. */
  threshold?: number;
  /** Edge set: gradient strength, 0 to 1, that draws `- / | \`. Default 0.22. */
  edgeThreshold?: number;
  /** Ordered dithering between glyph levels. Default `"none"`. */
  dither?: "none" | DitherMatrix;
  /** Animated entrance of the art. Default `"none"`. */
  reveal?: AsciiTextReveal;
  /** When the reveal plays. `hover` replays it on every pointer enter. Default `"view"`. */
  trigger?: AsciiTextTrigger;
  /** Reveal length in seconds. Default 1.2. */
  duration?: number;
  /** Shrink the type to fit the container's width. Default `true`. */
  fit?: boolean;
}

interface Art {
  readonly columns: number;
  readonly rows: number;
  readonly glyphs: readonly string[];
  /** One CSS colour per cell, or `null` for mono. */
  readonly colors: readonly string[] | null;
  readonly cellWidth: number;
}

// Supersampling per glyph sample: coverage is averaged over this many
// pixels per side, so curves land on the right glyph level.
const SUPERSAMPLE = 3;
const MAX_SAMPLE_PIXELS = 4_000_000;

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** A random glyph of the charset's denser half, for cells still settling. */
const noiseGlyph = (set: Charset, seed: number): string => {
  if (set.kind === "braille") {
    return brailleChar(1 + Math.floor(seed * 254));
  }
  const { glyphs } = set;
  const from = Math.max(1, Math.floor(glyphs.length / 2));
  return glyphs[from + Math.floor(seed * (glyphs.length - from))] ?? "#";
};

interface DrawOptions {
  readonly text: string;
  readonly font: string;
  readonly size: number;
  readonly cell: number;
  readonly glyphFont: string;
  readonly set: Charset;
  readonly maxWidth: number;
  readonly fit: boolean;
  readonly map: Parameters<typeof mapTones>[3];
}

/** Draw the text into an offscreen canvas and map its coverage to glyphs. */
const drawArt = ({
  text,
  font,
  size,
  cell,
  glyphFont,
  set,
  maxWidth,
  fit,
  map,
}: DrawOptions): Art | null => {
  const metrics = measureCell({ cell, dpr: 1, font: glyphFont });
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) {
    return null;
  }
  const lines = text.split("\n");
  const measure = (px: number) => {
    probe.font = `${font.replace("{size}", `${px}px`)}`;
    let width = 0;
    let ascent = 0;
    let descent = 0;
    for (const line of lines) {
      const m = probe.measureText(line);
      width = Math.max(width, m.width);
      ascent = Math.max(ascent, m.actualBoundingBoxAscent);
      descent = Math.max(descent, m.actualBoundingBoxDescent);
    }
    return { ascent, descent, width };
  };
  let px = size;
  let box = measure(px);
  const padding = metrics.width * 2;
  if (fit && maxWidth > 0 && box.width + padding > maxWidth) {
    px = Math.max(8, (px * (maxWidth - padding)) / box.width);
    box = measure(px);
  }
  const lineGap = px * 0.2;
  const lineHeight = box.ascent + box.descent;
  const textHeight = lineHeight * lines.length + lineGap * (lines.length - 1);
  const columns = Math.max(1, Math.ceil((box.width + padding) / metrics.width));
  const rows = Math.max(1, Math.ceil(textHeight / metrics.height) + 1);
  const field = createToneField(columns, rows, set);
  const scale = Math.max(
    1,
    Math.min(
      SUPERSAMPLE,
      Math.floor(Math.sqrt(MAX_SAMPLE_PIXELS / (field.width * field.height)))
    )
  );
  const canvas = document.createElement("canvas");
  canvas.width = field.width * scale;
  canvas.height = field.height * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  const artWidth = columns * metrics.width;
  const artHeight = rows * metrics.height;
  // Sample cells are not square, so the two axes scale differently.
  context.setTransform(
    canvas.width / artWidth,
    0,
    0,
    canvas.height / artHeight,
    0,
    0
  );
  context.font = font.replace("{size}", `${px}px`);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const top = (artHeight - textHeight) / 2;
  for (const [index, line] of lines.entries()) {
    context.fillText(
      line,
      artWidth / 2,
      top + box.ascent + index * (lineHeight + lineGap)
    );
  }
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const { tones, width } = field;
  const area = scale * scale * 255;
  for (let y = 0; y < field.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < scale; dy += 1) {
        const rowStart = ((y * scale + dy) * canvas.width + x * scale) * 4 + 3;
        for (let dx = 0; dx < scale; dx += 1) {
          sum += data[rowStart + dx * 4] ?? 0;
        }
      }
      tones[y * width + x] = sum / area;
    }
  }
  const frame = mapTones(field, columns, rows, { ...map, charset: set });
  let colors: string[] | null = null;
  if (frame.colors) {
    colors = [];
    for (let index = 0; index < columns * rows; index += 1) {
      const at = index * 4;
      colors.push(
        rgbToHex([
          frame.colors[at] ?? 0,
          frame.colors[at + 1] ?? 0,
          frame.colors[at + 2] ?? 0,
        ])
      );
    }
  }
  return {
    cellWidth: metrics.width,
    colors,
    columns,
    glyphs: [...frame.glyphs],
    rows,
  };
};

/** The art at `progress` (0 to 1) through a reveal. */
const revealGlyph = (
  art: Art,
  set: Charset,
  reveal: AsciiTextReveal,
  progress: number,
  index: number,
  tick: number
): string => {
  const glyph = art.glyphs[index] ?? " ";
  if (reveal === "none" || progress >= 1) {
    return glyph;
  }
  const column = index % art.columns;
  const row = (index - column) / art.columns;
  switch (reveal) {
    case "decode": {
      if (glyph === " ") {
        return glyph;
      }
      const settle = 0.15 + hash(index, 7) * 0.8;
      return progress >= settle ? glyph : noiseGlyph(set, hash(index, tick));
    }
    case "scan": {
      const front = progress * (art.rows + 2) - 1;
      if (row < front - 1) {
        return glyph;
      }
      if (row < front) {
        return glyph === " " ? glyph : noiseGlyph(set, hash(index, tick));
      }
      return " ";
    }
    case "wipe": {
      const ragged = (hash(row, 3) - 0.5) * 6;
      const front = progress * (art.columns + 12) - 6 + ragged;
      if (column < front - 3) {
        return glyph;
      }
      if (column < front) {
        return glyph === " " ? glyph : noiseGlyph(set, hash(index, tick));
      }
      return " ";
    }
    default: {
      const exhaustive: never = reveal;
      return exhaustive;
    }
  }
};

interface LinesOptions {
  readonly art: Art;
  readonly set: Charset;
  readonly reveal: AsciiTextReveal;
  readonly progress: number;
  readonly tick: number;
  readonly ink: string;
}

/** One line of text per row, or colour runs as spans when the art has colour. */
const artLines = ({
  art,
  set,
  reveal,
  progress,
  tick,
  ink,
}: LinesOptions): ReactNode[] => {
  const lines: ReactNode[] = [];
  for (let row = 0; row < art.rows; row += 1) {
    const glyphAt = (column: number) =>
      revealGlyph(art, set, reveal, progress, row * art.columns + column, tick);
    if (!art.colors) {
      let line = "";
      for (let column = 0; column < art.columns; column += 1) {
        line += glyphAt(column);
      }
      lines.push(`${line}\n`);
      continue;
    }
    // Colour runs: one span per stretch of cells that share a colour.
    const spans: ReactNode[] = [];
    let run = "";
    let runColor = "";
    for (let column = 0; column < art.columns; column += 1) {
      const cellColor = art.colors[row * art.columns + column] ?? ink;
      if (cellColor !== runColor && run !== "") {
        spans.push(
          <span key={column} style={{ color: runColor }}>
            {run}
          </span>
        );
        run = "";
      }
      runColor = cellColor;
      run += glyphAt(column);
    }
    spans.push(
      <span key="end" style={{ color: runColor }}>
        {run}
      </span>
    );
    lines.push(
      <span key={row}>
        {spans}
        {"\n"}
      </span>
    );
  }
  return lines;
};

/**
 * The reveal clock: 0 to 1 over `duration` seconds once `armed`, again
 * whenever `replay` changes, and 1 at once when disabled. `tick` steps 20
 * times a second for the glyphs that are still settling.
 */
const useReveal = ({
  enabled,
  armed,
  duration,
  replay,
}: {
  enabled: boolean;
  armed: boolean;
  duration: number;
  replay: number;
}): { progress: number; tick: number } => {
  const [progress, setProgress] = useState(enabled ? 0 : 1);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setProgress(1);
      return;
    }
    if (!armed) {
      setProgress(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const value = Math.min(1, (now - start) / (duration * 1000));
      setProgress(value);
      setTick(Math.floor(now / 50));
      if (value < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `replay` is a counter whose only job is to restart the clock.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, armed, duration, replay]);
  return { progress, tick };
};

interface ArtOptions {
  readonly text: string;
  readonly size: number;
  readonly cell: number;
  readonly charset: CharsetName;
  readonly chars: string | undefined;
  readonly colorMode: "mono" | "duotone";
  readonly ramp: RampName;
  readonly threshold: number | undefined;
  readonly edgeThreshold: number | undefined;
  readonly dither: "none" | DitherMatrix;
  readonly fit: boolean;
}

/** The art for the element's text, redrawn on resize and when fonts load. */
const useArt = (
  ref: RefObject<HTMLElement | null>,
  {
    text,
    size,
    cell,
    charset,
    chars,
    colorMode,
    ramp,
    threshold,
    edgeThreshold,
    dither,
    fit,
  }: ArtOptions
): Art | null => {
  const [art, setArt] = useState<Art | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    let frame = 0;
    let lastWidth = -1;
    const render = () => {
      const width = root.clientWidth;
      if (width === lastWidth) {
        return;
      }
      lastWidth = width;
      const computed = getComputedStyle(root);
      const font = `${computed.fontStyle} ${computed.fontWeight} {size} ${computed.fontFamily}`;
      setArt(
        drawArt({
          cell,
          fit,
          font,
          glyphFont: readFont(root),
          map: { colorMode, dither, edgeThreshold, ramp, threshold },
          maxWidth: width,
          set: resolveCharset(charset, chars),
          size,
          text,
        })
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const refresh = () => {
      lastWidth = -1;
      schedule();
    };
    let cancelled = false;
    const whenFontsLoad = async () => {
      await document.fonts.ready;
      if (!cancelled) {
        refresh();
      }
    };
    whenFontsLoad();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    document.fonts.addEventListener("loadingdone", refresh);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", refresh);
    };
  }, [
    ref,
    text,
    size,
    cell,
    charset,
    chars,
    colorMode,
    ramp,
    threshold,
    edgeThreshold,
    dither,
    fit,
  ]);
  return art;
};

type TextVars = CSSProperties & Record<"--text-cell", string>;

/**
 * Display type drawn as ASCII art: the text is rendered in the page's own
 * font into an offscreen canvas, sampled into a tone field and mapped to
 * glyphs of any charset. The real text stays in the element for screen
 * readers, search and copy, and shows on its own until the art mounts.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiText = ({
  children,
  as: Tag = "h2",
  size = 96,
  cell = 8,
  charset = "braille",
  chars,
  colorMode = "mono",
  ramp = "mainframe",
  color = "ink",
  threshold,
  edgeThreshold,
  dither = "none",
  reveal = "none",
  trigger = "view",
  duration = 1.2,
  fit = true,
  className,
  style,
  onPointerEnter,
  ...props
}: AsciiTextProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const [replay, setReplay] = useState(0);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const set = resolveCharset(charset, chars);

  const art = useArt(rootRef, {
    cell,
    chars,
    charset,
    colorMode,
    dither,
    edgeThreshold,
    fit,
    ramp,
    size,
    text: children,
    threshold,
  });

  const { progress, tick } = useReveal({
    armed: trigger === "view" ? inView : true,
    duration,
    // Hover shows the finished art until the first pointer enter.
    enabled:
      reveal !== "none" &&
      !reduced &&
      art !== null &&
      !(trigger === "hover" && replay === 0),
    replay,
  });

  const vars: TextVars = { "--text-cell": `${cell}px` };
  const ink = cssColor(color);

  const lines = art
    ? artLines({ art, ink, progress, reveal, set, tick })
    : null;

  return (
    <Tag
      ref={setRoot}
      data-slot="ascii-text"
      data-state={art ? "art" : "text"}
      className={cn("relative block", className)}
      style={{ ...vars, ...style }}
      onPointerEnter={(event) => {
        if (trigger === "hover") {
          setReplay((value) => value + 1);
        }
        onPointerEnter?.(event);
      }}
      {...props}
    >
      <span
        className={art ? "sr-only" : "block text-center"}
        style={art ? undefined : { fontSize: size, lineHeight: LINE_HEIGHT }}
      >
        {children}
      </span>
      {art ? (
        <pre
          aria-hidden="true"
          className="m-0 overflow-hidden text-center font-[family-name:var(--ascii-font,ui-monospace,monospace)] leading-[var(--text-cell)] font-normal tracking-normal whitespace-pre [font-size:calc(var(--text-cell)/1.2)] [font-variant-ligatures:none]"
          style={{ color: ink }}
        >
          {lines}
        </pre>
      ) : null}
    </Tag>
  );
};

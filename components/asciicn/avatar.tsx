"use client";

import {
  Children,
  createContext,
  isValidElement,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import {
  createToneField,
  cssColor,
  frameLines,
  mapTones,
  resolveCharset,
  rgbToHex,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiFrame,
  CharsetName,
  ColorMode,
  DitherMatrix,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export type AvatarStatus = "online" | "away" | "busy" | "offline";

export type AvatarShape = "circle" | "square";

export interface AvatarProps extends Omit<
  ComponentProps<"span">,
  "children" | "color"
> {
  /** Who it is. Gives the initials and, without `color`, the tint. */
  name: string;
  /** Accessible name, when it should differ from `name` (an email, say). Default `name`. */
  label?: string;
  /** A photo to draw as a glyph portrait instead of initials. */
  src?: string;
  /** `sm` 32px, `md` 48px, `lg` 72px, `xl` 112px, or a size in CSS pixels. Default `"md"`, or the group's size. */
  size?: AvatarSize | number;
  /** Glyphs to draw with. Default `"braille"`, the finest at avatar sizes. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .:oO@"`. Wins over `charset`. */
  chars?: string;
  /** `src` only: `truecolor` keeps the photo's colours per glyph. Default `"mono"`. */
  colorMode?: Extract<ColorMode, "mono" | "truecolor">;
  /** Tint of the disc: a palette name or any CSS colour. Default: picked from `name`. */
  color?: AsciiColor;
  /** A disc, or a square that fills the whole grid. Default `"circle"`. */
  shape?: AvatarShape;
  /** A status glyph in the corner: `●` online, `◐` away, `■` busy, `○` offline. */
  status?: AvatarStatus;
}

interface Metrics {
  /** Rows of glyph cells; the grid is twice as many columns wide. */
  readonly rows: number;
  /** Cell height in CSS pixels. */
  readonly cell: number;
}

const SIZES = {
  lg: { cell: 9, rows: 8 },
  md: { cell: 8, rows: 6 },
  sm: { cell: 8, rows: 4 },
  xl: { cell: 112 / 12, rows: 12 },
} as const satisfies Record<AvatarSize, Metrics>;

/** Tints an avatar picks from by name: the palette minus ink and grey. */
const TINTS = ["blue", "purple", "green", "pink", "orange", "red"] as const;

const STATUS = {
  away: { color: "orange", glyph: "◐", text: "away" },
  busy: { color: "red", glyph: "■", text: "busy" },
  offline: { color: "grey", glyph: "○", text: "offline" },
  online: { color: "green", glyph: "●", text: "online" },
} as const satisfies Record<
  AvatarStatus,
  { color: AsciiColor; glyph: string; text: string }
>;

/** Canvas pixels per side the source is drawn at before sampling. */
const RASTER = 160;

const metricsFor = (size: AvatarSize | number): Metrics => {
  if (typeof size === "string") {
    return SIZES[size];
  }
  const rows = Math.min(24, Math.max(3, Math.round(size / 8.5)));
  return { cell: size / rows, rows };
};

/** A stable hash of a string, for picking a tint. */
const hash = (value: string): number => {
  let out = 0;
  for (const char of value) {
    out = (out * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return out;
};

/** Up to two initials: "Ada Lovelace" is AL, "deploy-bot" DB, "grace@navy.mil" G. */
export const initialsOf = (name: string): string => {
  const local = name.split("@")[0] ?? name;
  const words = local.split(/[\s._-]+/u).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
  return letters.join("").toUpperCase() || "?";
};

/** True when (u, v), both 0 to 1, falls inside the avatar's shape. */
const insideShape = (shape: AvatarShape, u: number, v: number): boolean =>
  shape === "square" || (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.25;

/**
 * Area-average a square canvas onto a sample grid. Returns coverage
 * (alpha times luma, or alpha alone) and colour bytes per sample.
 */
const sampleRaster = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  useLuma: boolean
): { tones: Float32Array; colors: Uint8ClampedArray } => {
  const { data } = context.getImageData(0, 0, RASTER, RASTER);
  const tones = new Float32Array(width * height);
  const colors = new Uint8ClampedArray(width * height * 4);
  for (let sy = 0; sy < height; sy += 1) {
    const y0 = Math.floor((sy / height) * RASTER);
    const y1 = Math.max(y0 + 1, Math.floor(((sy + 1) / height) * RASTER));
    for (let sx = 0; sx < width; sx += 1) {
      const x0 = Math.floor((sx / width) * RASTER);
      const x1 = Math.max(x0 + 1, Math.floor(((sx + 1) / width) * RASTER));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * RASTER + x) * 4;
          r += data[at] ?? 0;
          g += data[at + 1] ?? 0;
          b += data[at + 2] ?? 0;
          a += data[at + 3] ?? 0;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const alpha = a / count / 255;
      const index = sy * width + sx;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / count / 255;
      tones[index] = useLuma ? lum * alpha : alpha;
      colors.set([r / count, g / count, b / count, 255], index * 4);
    }
  }
  return { colors, tones };
};

/**
 * The 2nd and 98th percentile tones inside the shape, for auto levels.
 * Never closer than 0.1 apart, so a flat photo isn't blown out.
 */
const toneRange = (
  tones: Float32Array,
  width: number,
  height: number,
  shape: AvatarShape
): [number, number] => {
  const inside: number[] = [];
  for (let index = 0; index < tones.length; index += 1) {
    const u = ((index % width) + 0.5) / width;
    const v = (Math.floor(index / width) + 0.5) / height;
    if (insideShape(shape, u, v)) {
      inside.push(tones[index] ?? 0);
    }
  }
  inside.sort((a, b) => a - b);
  const low = inside[Math.floor(inside.length * 0.02)] ?? 0;
  const high = inside[Math.floor(inside.length * 0.98)] ?? 1;
  return [low, Math.max(high, low + 0.1)];
};

/** The largest of a sample and its eight neighbours: grows a shape by one sample. */
const dilate = (tones: Float32Array, width: number, height: number) => {
  const out = new Float32Array(tones.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let peak = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            peak = Math.max(peak, tones[ny * width + nx] ?? 0);
          }
        }
      }
      out[y * width + x] = peak;
    }
  }
  return out;
};

/**
 * The tone of the disc behind the initials: lit from the upper left, so
 * it reads as a sphere, darkest at the lower right rim.
 */
const discTone = (u: number, v: number): number => {
  const light = Math.hypot(u - 0.3, v - 0.26);
  return Math.min(0.62, Math.max(0.16, 0.66 - light * 0.62));
};

/**
 * The lit disc (or square) alone, as glyphs. Pure, so it renders on the
 * server too. `clear` blanks samples around the initials so they read.
 */
const discFrame = ({
  rows,
  charset,
  chars,
  shape,
  clear,
}: {
  rows: number;
  charset: CharsetName;
  chars: string | undefined;
  shape: AvatarShape;
  clear?: Float32Array;
}): AsciiFrame => {
  const columns = rows * 2;
  const field = createToneField(columns, rows, resolveCharset(charset, chars));
  const { width, height, tones } = field;
  for (let index = 0; index < tones.length; index += 1) {
    const u = ((index % width) + 0.5) / width;
    const v = (Math.floor(index / width) + 0.5) / height;
    const blank = (clear?.[index] ?? 0) > 0.12;
    tones[index] = insideShape(shape, u, v) && !blank ? discTone(u, v) : 0;
  }
  const { kind } = resolveCharset(charset, chars);
  return mapTones(field, columns, rows, {
    chars,
    charset,
    dither: kind === "ramp" ? "none" : "bayer4",
  });
};

interface Portrait {
  /** The tinted layer: the disc, or the whole photo. */
  readonly base: AsciiFrame;
  /** The initials, drawn over the disc in the foreground colour. */
  readonly letters: AsciiFrame | null;
}

interface PortraitInput {
  readonly name: string;
  readonly image: HTMLImageElement | null;
  readonly rows: number;
  readonly charset: CharsetName;
  readonly chars: string | undefined;
  readonly colorMode: "mono" | "truecolor";
  readonly shape: AvatarShape;
  /** Dense glyphs for dark pixels, for dark ink on light paper. */
  readonly invert: boolean;
  readonly font: string;
}

const drawPortrait = (input: PortraitInput): Portrait | null => {
  const columns = input.rows * 2;
  const resolved = resolveCharset(input.charset, input.chars);
  const [gx, gy] = resolved.grid;
  const width = columns * gx;
  const height = input.rows * gy;
  const canvas = document.createElement("canvas");
  canvas.width = RASTER;
  canvas.height = RASTER;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  // Ordered dithering between dots, for the mid tones of photos; ramps
  // already have levels for them.
  const dither: DitherMatrix | "none" =
    resolved.kind === "ramp" ? "none" : "bayer4";
  const options = { chars: input.chars, charset: input.charset };

  if (input.image) {
    // Cover-fit the photo into the square.
    const { naturalWidth: iw, naturalHeight: ih } = input.image;
    const scale = Math.max(RASTER / iw, RASTER / ih);
    context.drawImage(
      input.image,
      (RASTER - iw * scale) / 2,
      (RASTER - ih * scale) / 2,
      iw * scale,
      ih * scale
    );
    const { tones, colors } = sampleRaster(context, width, height, true);
    const field: ToneField = { colors, height, tones, width };
    const [low, high] = toneRange(tones, width, height, input.shape);
    for (let index = 0; index < tones.length; index += 1) {
      const u = ((index % width) + 0.5) / width;
      const v = (Math.floor(index / width) + 0.5) / height;
      // Auto levels: stretch the photo's own range to the full ramp, so a
      // small portrait keeps its contrast.
      const tone = Math.min(
        1,
        Math.max(0, ((tones[index] ?? 0) - low) / (high - low))
      );
      tones[index] = insideShape(input.shape, u, v)
        ? (input.invert ? 1 - tone : tone) * 0.94 + 0.03
        : 0;
    }
    return {
      base: mapTones(field, columns, input.rows, {
        ...options,
        colorMode: input.colorMode,
        dither,
      }),
      letters: null,
    };
  }

  // Four rows hold one legible letter, not two.
  const initials = [...initialsOf(input.name)]
    .slice(0, input.rows <= 4 ? 1 : 2)
    .join("");
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const fontSize = RASTER * (initials.length > 1 ? 0.46 : 0.56);
  context.font = `700 ${fontSize}px ${input.font}`;
  context.fillText(initials, RASTER / 2, RASTER * 0.53);
  // The halo is found at the disc's resolution; the letters themselves are
  // drawn in quadrant blocks, whose solid 2x2 pixels stay legible at
  // avatar sizes where Braille dots shrink below a pixel.
  const halo = dilate(
    sampleRaster(context, width, height, false).tones,
    width,
    height
  );
  const letterWidth = columns * 2;
  const letterHeight = input.rows * 2;

  const disc = discFrame({
    chars: input.chars,
    charset: input.charset,
    clear: halo,
    rows: input.rows,
    shape: input.shape,
  });
  const letters: ToneField = {
    colors: null,
    height: letterHeight,
    tones: sampleRaster(context, letterWidth, letterHeight, false).tones,
    width: letterWidth,
  };
  return {
    base: disc,
    letters: mapTones(letters, columns, input.rows, {
      charset: "quadrants",
      threshold: 0.42,
    }),
  };
};

/** One row of a coloured frame as runs of same-coloured glyphs. */
const colorRuns = (frame: AsciiFrame, row: number) => {
  const runs: { color: string; text: string }[] = [];
  for (let column = 0; column < frame.columns; column += 1) {
    const index = row * frame.columns + column;
    const glyph = frame.glyphs[index] ?? " ";
    const at = index * 4;
    const color = frame.colors
      ? rgbToHex([
          frame.colors[at] ?? 0,
          frame.colors[at + 1] ?? 0,
          frame.colors[at + 2] ?? 0,
        ])
      : "";
    const last = runs.at(-1);
    if (last && (last.color === color || glyph === " ")) {
      last.text += glyph;
    } else {
      runs.push({ color, text: glyph });
    }
  }
  return runs;
};

const Layer = ({
  frame,
  color,
  className,
}: {
  frame: AsciiFrame;
  color?: string;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn("absolute inset-0 block", className)}
    style={color ? { color } : undefined}
  >
    {frame.colors
      ? Array.from({ length: frame.rows }, (_, row) => (
          // Rows are positional, top to bottom.
          // oxlint-disable-next-line react/no-array-index-key
          <span key={row} className="block">
            {colorRuns(frame, row).map((run, index) => (
              // oxlint-disable-next-line react/no-array-index-key
              <span key={index} style={{ color: run.color }}>
                {run.text}
              </span>
            ))}
          </span>
        ))
      : frameLines(frame).join("\n")}
  </span>
);

/** Text style that makes one line one glyph cell, sized to the grid. */
const glyphBoxStyle = (metrics: Metrics): CSSProperties => ({
  fontFamily: "var(--ascii-font, monospace)",
  fontSize: `${metrics.cell / GLYPH_EM}px`,
  fontVariantLigatures: "none",
  height: `${metrics.cell * metrics.rows}px`,
  letterSpacing: 0,
  lineHeight: `${metrics.cell}px`,
  whiteSpace: "pre",
  width: `${metrics.rows * 2}ch`,
});

/** Short text centred on the disc, on a paper backing so it reads over the glyphs. */
const CenterText = ({ side, children }: { side: number; children: string }) => (
  <span
    aria-hidden="true"
    className="text-foreground absolute inset-0 flex items-center justify-center font-mono font-semibold tabular-nums"
    style={{ fontSize: `${Math.max(9, side * 0.3)}px`, lineHeight: 1 }}
  >
    <span className="rounded-[2px] bg-[var(--ascii-paper)] px-[0.2em]">
      {children}
    </span>
  </span>
);

const GroupContext = createContext<{
  size: AvatarSize | number;
  outline: string;
} | null>(null);

/** Load an image for sampling; null until it has loaded, or if it fails. */
const useImage = (src: string | undefined) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!src) {
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const loaded = () => setImage(img);
    img.addEventListener("load", loaded);
    img.src = src;
    return () => img.removeEventListener("load", loaded);
  }, [src]);
  return image;
};

/**
 * An avatar drawn in glyphs. With a `src`, the photo is sampled into a
 * glyph portrait (Braille by default, any charset works); without one, the
 * initials are set in a glyph font over a lit disc of dots in a tint
 * picked from the name. A status glyph can sit in the corner, and
 * `AvatarGroup` stacks several with an overlap.
 */
export const Avatar = ({
  name,
  label,
  src,
  size,
  charset = "braille",
  chars,
  colorMode = "mono",
  color,
  shape = "circle",
  status,
  className,
  style,
  ...props
}: AvatarProps) => {
  const group = use(GroupContext);
  const metrics = metricsFor(size ?? group?.size ?? "md");
  const ref = useRef<HTMLSpanElement>(null);
  const colors = useAsciiColors(ref);
  const image = useImage(src);
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const tint = color ?? TINTS[hash(name) % TINTS.length] ?? "blue";
  const accessibleName = [label ?? name, status ? STATUS[status].text : null]
    .filter(Boolean)
    .join(", ");

  const invert = colors
    ? colors[0][0] + colors[0][1] + colors[0][2] <
      colors[1][0] + colors[1][1] + colors[1][2]
    : false;

  useEffect(() => {
    const el = ref.current;
    if (!el || (src && !image)) {
      return;
    }
    setPortrait(
      drawPortrait({
        chars,
        charset,
        colorMode,
        font: getComputedStyle(el).fontFamily,
        image,
        invert,
        name,
        rows: metrics.rows,
        shape,
      })
    );
  }, [
    chars,
    charset,
    colorMode,
    image,
    invert,
    metrics.rows,
    name,
    shape,
    src,
  ]);

  const fallbackDisc = discFrame({ chars, charset, rows: metrics.rows, shape });
  const glyphBox = glyphBoxStyle(metrics);
  const statusSize = Math.max(10, metrics.cell * metrics.rows * 0.3);

  return (
    <span
      ref={ref}
      role="img"
      aria-label={accessibleName}
      className={cn(
        "relative inline-flex shrink-0 align-middle select-none",
        className
      )}
      style={style}
      {...props}
    >
      <span
        className={cn(
          "relative block overflow-hidden bg-[var(--ascii-paper)]",
          shape === "circle" ? "rounded-full" : "rounded-[2px]"
        )}
        style={{
          ...glyphBox,
          boxShadow: group ? `0 0 0 2px ${group.outline}` : undefined,
        }}
      >
        {portrait ? (
          <>
            <Layer
              frame={portrait.base}
              color={portrait.base.colors ? undefined : cssColor(tint)}
            />
            {portrait.letters ? (
              <Layer frame={portrait.letters} className="text-foreground" />
            ) : null}
          </>
        ) : (
          // Before the initials are drawn (and on the server): the disc
          // with the initials as plain text.
          <>
            <Layer frame={fallbackDisc} color={cssColor(tint)} />
            <CenterText side={metrics.cell * metrics.rows}>
              {initialsOf(name)}
            </CenterText>
          </>
        )}
      </span>
      {status ? (
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 flex items-center justify-center rounded-full bg-[var(--ascii-paper)] leading-none"
          style={{
            color: cssColor(STATUS[status].color),
            fontFamily: "var(--ascii-font, monospace)",
            fontSize: `${statusSize * 0.82}px`,
            height: `${statusSize}px`,
            width: `${statusSize}px`,
          }}
        >
          {STATUS[status].glyph}
        </span>
      ) : null}
    </span>
  );
};

export interface AvatarGroupProps extends ComponentProps<"div"> {
  /** The avatars, in order. */
  children: ReactNode;
  /** Show at most this many, then a `+n` count. Default: all. */
  max?: number;
  /** Size of every avatar in the group. Default `"md"`. */
  size?: AvatarSize | number;
  /** Colour of the ring that separates overlapping avatars. Default `--ascii-paper`. */
  outline?: string;
}

/**
 * Avatars in a row, each overlapping the one before by a quarter of its
 * width, with a ring in the page colour between them. Past `max`, the
 * rest collapse into a `+n` disc.
 */
export const AvatarGroup = ({
  children,
  max,
  size = "md",
  outline = "var(--ascii-paper)",
  className,
  ...props
}: AvatarGroupProps) => {
  const items = Children.toArray(children);
  const shown = max === undefined ? items : items.slice(0, Math.max(1, max));
  const hidden = items.length - shown.length;
  const metrics = metricsFor(size);
  const side = metrics.cell * metrics.rows;
  const overlap = `${-side * 0.25}px`;

  return (
    <GroupContext value={{ outline, size }}>
      <div
        role="group"
        className={cn("flex items-center", className)}
        {...props}
      >
        {shown.map((child, index) => (
          <span
            key={
              isValidElement(child) && child.key !== null ? child.key : index
            }
            className="relative flex"
            style={{ marginLeft: index === 0 ? 0 : overlap }}
          >
            {child}
          </span>
        ))}
        {hidden > 0 ? (
          <span className="relative flex" style={{ marginLeft: overlap }}>
            <span
              className="relative block overflow-hidden rounded-full bg-[var(--ascii-paper)]"
              style={{
                ...glyphBoxStyle(metrics),
                boxShadow: `0 0 0 2px ${outline}`,
                color: cssColor("grey"),
              }}
            >
              <Layer
                frame={discFrame({
                  chars: undefined,
                  charset: "braille",
                  rows: metrics.rows,
                  shape: "circle",
                })}
              />
              <CenterText side={side}>{`+${hidden}`}</CenterText>
            </span>
            <span className="sr-only">{`and ${hidden} more`}</span>
          </span>
        ) : null}
      </div>
    </GroupContext>
  );
};

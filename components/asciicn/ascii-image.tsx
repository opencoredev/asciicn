"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, RefObject } from "react";

import {
  AsciiGrid,
  autoLevels as stretchLevels,
  CrtOverlay,
  createToneField,
  hexToRgb,
  luma,
  mapTones,
  PHOSPHORS,
  RAMPS,
  resolveCharset,
  sampleToField,
  SPINNERS,
  useAsciiColors,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  Charset,
  MapOptions,
  MutableFrame,
  Rgb8,
  SampleCrop,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Colour: ink, paper and which way tones run                                  */
/* -------------------------------------------------------------------------- */

/** Ink and paper for a look, and whether dark source pixels draw dense glyphs. */
export interface GlyphPaint {
  readonly ink: AsciiColor;
  readonly paper: AsciiColor | "transparent";
  /**
   * Dense glyphs stand for dark pixels. True on a light page, where ink is
   * dark, so a photo still reads the right way round.
   */
  readonly darkIsDense: boolean;
  /** Paper then ink as bytes, for `colorMode="palette"`. */
  readonly palette: readonly Rgb8[];
}

const toBytes = ([r, g, b]: readonly number[]): Rgb8 => [
  Math.round((r ?? 0) * 255),
  Math.round((g ?? 0) * 255),
  Math.round((b ?? 0) * 255),
];

const rampPaper = (ramp: AsciiLook["ramp"]): string => {
  if (ramp === undefined) {
    return RAMPS.mainframe[0];
  }
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.mainframe)[0];
  }
  return ramp[0] ?? RAMPS.mainframe[0];
};

/**
 * Ink and paper for a look, following the theme. Phosphors and duotone
 * ramps are screen looks: they bring their own dark glass, whatever the
 * page theme. Everything else draws in `--ascii-ink` on `--ascii-paper`.
 */
export const useGlyphPaint = (
  ref: RefObject<Element | null>,
  {
    colorMode,
    phosphor,
    ramp,
    invert,
    background = "paper",
  }: Pick<
    AsciiLook,
    "colorMode" | "phosphor" | "ramp" | "invert" | "background"
  >
): GlyphPaint => {
  const theme = useAsciiColors(ref);
  const transparent = background === "transparent";
  const themeInk: Rgb8 = theme ? toBytes(theme[0]) : [230, 230, 230];
  const themePaper: Rgb8 = theme ? toBytes(theme[1]) : [10, 10, 10];
  const pageIsLight = luma(...themePaper) > 0.5;

  if (colorMode === "duotone") {
    const paper = rampPaper(ramp);
    return {
      darkIsDense: invert ?? (transparent ? pageIsLight : false),
      ink: "--ascii-ink",
      palette: [hexToRgb(paper), themeInk],
      paper: transparent ? "transparent" : paper,
    };
  }
  if (phosphor && (colorMode === undefined || colorMode === "mono")) {
    const preset = PHOSPHORS[phosphor];
    return {
      darkIsDense: invert ?? (transparent ? pageIsLight : false),
      ink: preset.ink,
      palette: [hexToRgb(preset.paper), hexToRgb(preset.ink)],
      paper: transparent ? "transparent" : preset.paper,
    };
  }
  return {
    darkIsDense: invert ?? pageIsLight,
    ink: "--ascii-ink",
    palette: [themePaper, themeInk],
    paper: transparent ? "transparent" : "--ascii-paper",
  };
};

/**
 * Braille and quadrants light a dot or leave it dark, so without help a
 * soft gradient collapses to one hard edge. Blue-noise ordered dithering
 * keeps the gradient as a stipple; a ramp charset needs none.
 */
export const packedDither = (
  look: Pick<AsciiLook, "charset" | "chars">
): "none" | "blue-noise" => {
  const { kind } = resolveCharset(look.charset ?? "standard", look.chars);
  return kind === "braille" || kind === "quadrants" ? "blue-noise" : "none";
};

/**
 * The `mapTones` options for a look. Inversion is left to the sampler,
 * which knows which samples are empty (transparent or letterboxed) and
 * must stay empty either way round.
 */
export const lookToMapOptions = (
  look: AsciiLook,
  paint: GlyphPaint,
  fallbackMode: NonNullable<AsciiLook["colorMode"]> = "truecolor"
): MapOptions => ({
  ansi: look.ansi,
  chars: look.chars,
  charset: look.charset ?? "standard",
  colorMode: look.colorMode ?? fallbackMode,
  dither: look.dither ?? packedDither(look),
  edgeThreshold: look.edgeThreshold,
  grade: look.grade,
  invert: false,
  palette: paint.palette,
  ramp: look.ramp,
  threshold: look.threshold,
});

/**
 * Split the look props from everything else, so a component can hand the
 * look to its renderer and the rest to its wrapper element.
 */
export const splitLook = <Props extends AsciiLook>({
  charset,
  chars,
  colorMode,
  phosphor,
  ramp,
  ansi,
  grade,
  invert,
  threshold,
  edgeThreshold,
  dither,
  background,
  fx,
  ...rest
}: Props) =>
  [
    {
      ansi,
      background,
      chars,
      charset,
      colorMode,
      dither,
      edgeThreshold,
      fx,
      grade,
      invert,
      phosphor,
      ramp,
      threshold,
    } satisfies AsciiLook,
    rest,
  ] as const;

/* -------------------------------------------------------------------------- */
/* Sampling: any image, video or canvas into a tone field                      */
/* -------------------------------------------------------------------------- */

/** How media fills its box, as in `object-fit`. */
export type MediaFit = "cover" | "contain" | "fill";

/**
 * What a sample's tone measures. `luma` suits photos and video; `alpha`
 * suits logos and icons on a transparent background, where the shape is
 * the coverage and colour only tints it.
 */
export type MediaTone = "luma" | "alpha";

/** Something drawable and its natural size. `key` changes when the content does. */
export interface MediaInput {
  readonly element: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly key: string;
}

export interface MediaSampleOptions {
  readonly columns: number;
  readonly rows: number;
  readonly charset: Charset;
  /** The grid's width over height in CSS pixels. */
  readonly aspect: number;
  readonly fit: MediaFit;
  /** Where the media sits when it overflows, 0 to 1 per axis. */
  readonly focus: readonly [number, number];
  readonly mirror: boolean;
  readonly tone: MediaTone;
  readonly darkIsDense: boolean;
  /** Stretch the darkest and brightest 1% of tones to the ends of the ramp. */
  readonly levels: boolean;
}

/** The part of the source `cover` keeps, slid towards `focus`. */
const coverCrop = (
  { width, height }: Pick<MediaInput, "width" | "height">,
  aspect: number,
  [focusX, focusY]: readonly [number, number]
): SampleCrop => {
  const sourceAspect = width / Math.max(1, height);
  if (sourceAspect > aspect) {
    const keep = aspect / sourceAspect;
    return { height: 1, width: keep, x: (1 - keep) * focusX, y: 0 };
  }
  const keep = sourceAspect / aspect;
  return { height: keep, width: 1, x: 0, y: (1 - keep) * focusY };
};

/**
 * Sample media into a tone field with the engine's area-averaging
 * sampler, then set which way tones run. Samples outside the media
 * (letterboxing, transparent pixels) stay at tone 0 either way round, so
 * they draw nothing.
 */
export const sampleMedia = (
  source: MediaInput,
  field: ToneField,
  options: MediaSampleOptions
): void => {
  const { aspect, fit } = options;
  sampleToField(source.element, {
    aspect,
    charset: options.charset,
    columns: options.columns,
    crop:
      fit === "cover" ? coverCrop(source, aspect, options.focus) : undefined,
    fit: fit === "cover" ? "fill" : fit,
    into: field,
    mirror: options.mirror,
    rows: options.rows,
  });
  const { tones, colors } = field;
  if (options.tone === "alpha") {
    for (let index = 0; index < tones.length; index += 1) {
      tones[index] = (colors?.[index * 4 + 3] ?? 0) / 255;
    }
    return;
  }
  if (options.levels) {
    stretchLevels(field, 1);
  }
  if (options.darkIsDense) {
    for (let index = 0; index < tones.length; index += 1) {
      const cover = (colors?.[index * 4 + 3] ?? 255) / 255;
      tones[index] = Math.max(0, cover - (tones[index] ?? 0));
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Loading media                                                               */
/* -------------------------------------------------------------------------- */

/** Where an image is in loading. */
export type ImageState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly source: MediaInput }
  | { readonly status: "error" };

/**
 * Load and decode an image for sampling. Cross-origin files need CORS
 * headers, or the canvas can't read their pixels. `null` waits, for
 * images that load lazily.
 */
export const useLoadedImage = (
  src: string | null,
  crossOrigin: ComponentProps<"img">["crossOrigin"] = "anonymous"
): ImageState => {
  const [state, setState] = useState<ImageState>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    if (src === null) {
      return;
    }
    const image = new Image();
    if (crossOrigin !== undefined) {
      image.crossOrigin = crossOrigin;
    }
    image.decoding = "async";
    image.src = src;
    const load = async () => {
      try {
        await image.decode();
      } catch {
        if (current) {
          setState({ status: "error" });
        }
        return;
      }
      if (current) {
        setState({
          source: {
            element: image,
            height: image.naturalHeight || 1,
            key: src,
            width: image.naturalWidth || 1,
          },
          status: "ready",
        });
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [src, crossOrigin]);
  return state;
};

/* -------------------------------------------------------------------------- */
/* AsciiMedia: the shared renderer                                             */
/* -------------------------------------------------------------------------- */

/** What the `shape` and `finish` hooks of `AsciiMedia` get each frame. */
export interface MediaDrawContext extends AsciiGridDrawContext {
  readonly charset: Charset;
  /** The element's size in CSS pixels. */
  readonly box: { readonly width: number; readonly height: number };
}

export type MediaStatus = "loading" | "ready" | "error";

export interface AsciiMediaProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** What to draw, or `null` while it loads. */
  source: MediaInput | null;
  /** Drawn as a glyph placeholder until `"ready"`. Default `"ready"`. */
  status?: MediaStatus;
  /** Draw a loading sweep and error text in glyphs. Default `true`. */
  placeholder?: boolean;
  /** Shown in glyphs when `status` is `"error"`. Default `"image unavailable"`. */
  message?: string;
  /** Default `"cover"`. */
  fit?: MediaFit;
  /** Media position when it overflows its box, 0 to 1 per axis. Default centred. */
  focus?: readonly [number, number];
  /** Flip horizontally, as a webcam preview does. Default `false`. */
  mirror?: boolean;
  /** Default `"luma"`. */
  tone?: MediaTone;
  /** Stretch the media's tones to fill the ramp. Default `true`. */
  autoLevels?: boolean;
  /** Sample the source again every frame, for video. Default `false`. */
  live?: boolean;
  /** Glyph colour in `mono`, overriding the theme ink and any phosphor. */
  ink?: AsciiColor;
  /** Colour mode when `colorMode` is unset. Default `"truecolor"`. */
  defaultColorMode?: NonNullable<AsciiLook["colorMode"]>;
  /** Adjust tones after sampling, before glyphs are chosen. Runs every frame. */
  shape?: (field: ToneField, context: MediaDrawContext) => void;
  /** Adjust glyphs after mapping. Runs every frame. */
  finish?: (frame: MutableFrame, context: MediaDrawContext) => void;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** Keep drawing every frame. Default `false`: one frame per change. */
  animate?: boolean;
  /** Frame rate cap while animating. Default 30. */
  fps?: number;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

interface FieldCache {
  key: string;
  base: ToneField;
  work: ToneField;
}

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** A sweeping band of faint glyphs and a status line, while media loads. */
const drawPlaceholder = (
  context: AsciiGridDrawContext,
  status: Exclude<MediaStatus, "ready">,
  message: string
) => {
  const { frame, columns, rows, time } = context;
  const sweep = (time * 0.45) % 1.6;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = column / Math.max(1, columns - 1);
      const v = row / Math.max(1, rows - 1);
      const band =
        status === "loading"
          ? Math.exp(-((u + v * 0.35 - sweep + 0.2) ** 2) * 60)
          : 0;
      const grain = hash(column, row);
      const tone = 0.06 + band * 0.5;
      if (grain < tone) {
        frame.put(column, row, grain < tone * 0.4 ? ":" : "·");
      }
    }
  }
  const spinner = SPINNERS.braille;
  const label =
    status === "loading"
      ? `${spinner[Math.floor(time * 12) % spinner.length] ?? ""} loading`
      : `[ ${message} ]`;
  const text = label.slice(0, columns);
  const x = Math.floor((columns - text.length) / 2);
  const y = Math.floor(rows / 2);
  frame.fillRect(x - 1, y, text.length + 2, 1, " ");
  frame.write(x, y, text);
};

const CENTRE = [0.5, 0.5] as const;

/**
 * The renderer behind every media component: samples an image, video or
 * canvas into glyphs on an `AsciiGrid`. Charset and colour switch without
 * sampling again; size, fit and source changes sample once.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiMedia = (props: AsciiMediaProps) => {
  const [
    look,
    {
      source,
      status = "ready",
      placeholder = true,
      message = "image unavailable",
      fit = "cover",
      focus = CENTRE,
      mirror = false,
      tone = "luma",
      autoLevels = true,
      live = false,
      ink,
      defaultColorMode = "truecolor",
      shape,
      finish,
      cell = 10,
      animate = false,
      fps = 30,
      handle,
      className,
      ...rest
    },
  ] = splitLook(props);
  const rootRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<FieldCache | null>(null);
  const paint = useGlyphPaint(rootRef, look);
  const options = lookToMapOptions(look, paint, defaultColorMode);
  const resolved = resolveCharset(options.charset, options.chars);
  const mode = options.colorMode ?? "mono";

  const draw = (context: AsciiGridDrawContext) => {
    if (status !== "ready" || !source) {
      if (!placeholder) {
        return;
      }
      drawPlaceholder(
        context,
        status === "ready" ? "loading" : status,
        message
      );
      return;
    }
    const root = rootRef.current;
    const { columns, rows, metrics } = context;
    const box = {
      height: root?.clientHeight || rows * metrics.height,
      width: root?.clientWidth || columns * metrics.width,
    };
    const [gx, gy] = resolved.grid;
    const key = [
      source.key,
      columns,
      rows,
      gx,
      gy,
      metrics.width,
      metrics.height,
      box.width,
      box.height,
      fit,
      focus[0],
      focus[1],
      mirror,
      tone,
      autoLevels,
      paint.darkIsDense,
    ].join("|");
    let cache = cacheRef.current;
    if (!cache || cache.key !== key || live) {
      if (
        !cache ||
        cache.base.width !== columns * gx ||
        cache.base.height !== rows * gy
      ) {
        cache = {
          base: createToneField(columns, rows, resolved, { color: true }),
          key,
          work: createToneField(columns, rows, resolved, { color: true }),
        };
      }
      cache.key = key;
      sampleMedia(source, cache.base, {
        aspect: (columns * metrics.width) / (rows * metrics.height),
        charset: resolved,
        columns,
        darkIsDense: paint.darkIsDense,
        fit,
        focus,
        levels: autoLevels,
        mirror,
        rows,
        tone,
      });
      cacheRef.current = cache;
    }
    const mediaContext: MediaDrawContext = {
      ...context,
      box,
      charset: resolved,
    };
    let field = cache.base;
    if (shape) {
      cache.work.tones.set(cache.base.tones);
      if (cache.work.colors && cache.base.colors) {
        cache.work.colors.set(cache.base.colors);
      }
      shape(cache.work, mediaContext);
      field = cache.work;
    }
    mapTones(field, columns, rows, options, context.frame);
    finish?.(context.frame, mediaContext);
  };

  const grid = (
    <AsciiGrid
      ref={rootRef}
      draw={draw}
      cell={cell}
      ink={ink ?? paint.ink}
      paper={paint.paper}
      colored={mode !== "mono"}
      animate={animate || live || (placeholder && status === "loading")}
      fps={fps}
      handle={handle}
      data-status={status}
      className={cn("size-full", look.fx ? "absolute inset-0" : className)}
      {...(look.fx ? {} : rest)}
    />
  );
  if (!look.fx) {
    return grid;
  }
  // The CRT finish is a CSS layer over the canvas, so it needs a wrapper.
  return (
    <div className={cn("relative", className)} {...rest}>
      {grid}
      <CrtOverlay fx={look.fx} />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* AsciiImage                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the pointer does over the image.
 * - `none`: nothing.
 * - `spotlight`: glyphs thin out away from the pointer and run full
 *   density under it, like a torch over the page.
 * - `photo`: a soft window around the pointer shows the original photo.
 */
export const IMAGE_REVEALS = ["none", "spotlight", "photo"] as const;
export type ImageReveal = (typeof IMAGE_REVEALS)[number];

export interface AsciiImageProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Image URL. Cross-origin files need CORS headers. */
  src: string;
  /** What the image shows, read by screen readers. `""` marks it decorative. */
  alt: string;
  /** How the image fills its box. Default `"cover"`. */
  fit?: MediaFit;
  /** Image position when it overflows, 0 to 1 per axis. Default centred. */
  focus?: readonly [number, number];
  /** Stretch the image's tones to use the whole ramp. Default `true`. */
  autoLevels?: boolean;
  /** Pointer effect. Default `"none"`. */
  reveal?: ImageReveal;
  /** Radius of the reveal in CSS pixels. Default 120. */
  revealRadius?: number;
  /** Glyphs resolve in from noise once the image loads. Default `true`. */
  intro?: boolean;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** `false` skips the intro and the loading sweep. Default `true`. */
  animate?: boolean;
  /** Passed to the image request. Default `"anonymous"`. */
  crossOrigin?: ComponentProps<"img">["crossOrigin"];
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const INTRO_MS = 900;

// What braille and quadrant cells flicker through while they resolve.
const SCRAMBLE = [..."⠁⠂⠄⡀⠈⠐⠠⢀·:"];

/** Hide cells that haven't resolved yet and scramble the ones resolving. */
const resolveIn = (frame: MutableFrame, charset: Charset, progress: number) => {
  const { glyphs, columns } = frame;
  const ramp = charset.kind === "ramp" || charset.kind === "edge";
  const pool = ramp ? charset.glyphs.slice(1) : SCRAMBLE;
  for (let index = 0; index < glyphs.length; index += 1) {
    const column = index % columns;
    const row = (index - column) / columns;
    // Cells resolve roughly top to bottom, in a ragged order.
    const order = hash(column, row) * 0.7 + (row / frame.rows) * 0.3;
    if (order > progress + 0.12) {
      glyphs[index] = " ";
    } else if (order > progress && glyphs[index] !== " ") {
      glyphs[index] =
        pool[Math.floor(hash(row + progress * 31, column) * pool.length)] ??
        "·";
    }
  }
};

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * An image redrawn in glyphs, sampled on the CPU: every glyph is the area
 * average of the pixels under its cell. Charset and colour switch live.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiImage = (props: AsciiImageProps) => {
  const [
    look,
    {
      src,
      alt,
      fit = "cover",
      focus,
      autoLevels = true,
      reveal = "none",
      revealRadius = 120,
      intro = true,
      cell = 10,
      animate = true,
      crossOrigin = "anonymous",
      handle,
      className,
      style,
      ...rest
    },
  ] = splitLook(props);
  const image = useLoadedImage(src, crossOrigin);
  const reducedMotion = usePrefersReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ eased: 0, inside: false, x: 0, y: 0 });
  const intro0 = useRef({ at: 0, key: "" });
  const [introRunning, setIntroRunning] = useState(false);
  const playIntro = intro && animate && !reducedMotion;

  // Keep the loop running for the length of the intro, then let it rest.
  useEffect(() => {
    if (image.status !== "ready" || !playIntro) {
      setIntroRunning(false);
      return;
    }
    setIntroRunning(true);
    const timer = window.setTimeout(
      () => setIntroRunning(false),
      INTRO_MS + 120
    );
    return () => window.clearTimeout(timer);
  }, [image.status, playIntro]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || reveal === "none") {
      return;
    }
    const move = (event: PointerEvent) => {
      const box = wrapper.getBoundingClientRect();
      pointer.current.x = event.clientX - box.left;
      pointer.current.y = event.clientY - box.top;
      pointer.current.inside = true;
      wrapper.style.setProperty("--reveal-x", `${pointer.current.x}px`);
      wrapper.style.setProperty("--reveal-y", `${pointer.current.y}px`);
      wrapper.style.setProperty("--reveal-r", `${revealRadius}px`);
    };
    const leave = () => {
      pointer.current.inside = false;
      wrapper.style.setProperty("--reveal-r", "0px");
    };
    wrapper.addEventListener("pointermove", move, { passive: true });
    wrapper.addEventListener("pointerdown", move, { passive: true });
    wrapper.addEventListener("pointerleave", leave);
    wrapper.addEventListener("pointercancel", leave);
    return () => {
      wrapper.removeEventListener("pointermove", move);
      wrapper.removeEventListener("pointerdown", move);
      wrapper.removeEventListener("pointerleave", leave);
      wrapper.removeEventListener("pointercancel", leave);
    };
  }, [reveal, revealRadius]);

  const spotlight = (field: ToneField, context: MediaDrawContext) => {
    const state = pointer.current;
    // Ease the light in and out instead of snapping when the pointer enters.
    const target = state.inside ? 1 : 0;
    const rate = context.delta > 0 ? Math.min(1, context.delta * 6) : 1;
    state.eased += (target - state.eased) * rate;
    if (state.eased < 0.01) {
      return;
    }
    const [gx, gy] = context.charset.grid;
    const sampleWidth = context.metrics.width / gx;
    const sampleHeight = context.metrics.height / gy;
    const floor = 1 - 0.75 * state.eased;
    for (let y = 0; y < field.height; y += 1) {
      const dy = (y + 0.5) * sampleHeight - state.y;
      for (let x = 0; x < field.width; x += 1) {
        const dx = (x + 0.5) * sampleWidth - state.x;
        const light = smoothstep(
          revealRadius,
          revealRadius * 0.35,
          Math.hypot(dx, dy)
        );
        const index = y * field.width + x;
        field.tones[index] =
          (field.tones[index] ?? 0) * (floor + (1 - floor) * light);
      }
    }
  };

  const finish = (frame: MutableFrame, context: MediaDrawContext) => {
    if (!playIntro) {
      return;
    }
    // The intro clock starts on the first frame drawn from this image.
    if (intro0.current.key !== src) {
      intro0.current = { at: performance.now(), key: src };
    }
    const progress = (performance.now() - intro0.current.at) / INTRO_MS;
    if (progress < 1) {
      resolveIn(frame, context.charset, progress * 1.12);
    }
  };

  const decorative = alt === "";
  const showPhoto = reveal === "photo" && image.status === "ready";

  return (
    <div
      ref={wrapperRef}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
      data-status={image.status}
      className={cn("relative overflow-hidden", className)}
      style={
        {
          "--reveal-r": "0px",
          "--reveal-x": "50%",
          "--reveal-y": "50%",
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {showPhoto ? (
        // oxlint-disable-next-line nextjs/no-img-element -- the photo under the glyphs must match the sampled file exactly.
        <img
          src={src}
          alt=""
          crossOrigin={crossOrigin}
          className="absolute inset-0 size-full"
          style={{
            objectFit: fit,
            objectPosition: focus
              ? `${focus[0] * 100}% ${focus[1] * 100}%`
              : undefined,
          }}
        />
      ) : null}
      <AsciiMedia
        {...look}
        source={image.status === "ready" ? image.source : null}
        status={image.status}
        fit={fit}
        focus={focus}
        autoLevels={autoLevels}
        cell={cell}
        animate={
          animate &&
          (introRunning || reveal === "spotlight" || image.status === "loading")
        }
        shape={reveal === "spotlight" ? spotlight : undefined}
        finish={finish}
        handle={handle}
        className="absolute inset-0"
        style={
          showPhoto
            ? {
                maskImage:
                  "radial-gradient(circle at var(--reveal-x) var(--reveal-y), transparent calc(var(--reveal-r) * 0.5), black var(--reveal-r))",
              }
            : undefined
        }
      />
    </div>
  );
};

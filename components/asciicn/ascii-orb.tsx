"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiGrid,
  CrtOverlay,
  createToneField,
  hexToRgb,
  mapTones,
  PHOSPHORS,
  RAMPS,
  resolveCharset,
  useAsciiColors,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  MapOptions,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { useAudioBands } from "@/lib/ascii/audio";
import type { AudioBands, AudioSource } from "@/lib/ascii/audio";
import { cn } from "@/lib/utils";

/**
 * What the assistant is doing.
 * - `idle`: a slow breath.
 * - `listening`: rings draw inwards and the orb swells with the input level.
 * - `speaking`: lobes pulse with the bass and waves ripple outwards.
 */
export const ORB_STATES = ["idle", "listening", "speaking"] as const;
export type OrbState = (typeof ORB_STATES)[number];

export interface AsciiOrbProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Default `"idle"`. */
  state?: OrbState;
  /**
   * Sound that moves the orb: `"mic"`, `"synth"` (a silent demo tone), a
   * media element or stream, or bands you already analyse with
   * `useAudioBands`. Default: none, and the states animate on their own.
   */
  audio?: AudioSource | AudioBands;
  /** The two colours the surface drifts between, in truecolor. Default `["purple", "blue"]`. */
  colors?: readonly [AsciiColor, AsciiColor];
  /** Radius as a share of half the box's shorter side, 0.2 to 0.9. Default 0.62. */
  size?: number;
  /** How much the outline wobbles, 0 for a perfect sphere. Default 1. */
  morph?: number;
  /** How far the light and the orb lean towards the pointer, 0 to turn it off. Default 1. */
  lean?: number;
  /** Strength of the halo around the orb, 0 to 1. Default 0.6. */
  glow?: number;
  /** Time multiplier. Default 1. */
  speed?: number;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** `false` holds one still frame. Default `true`. */
  animate?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* Look                                                                        */
/* -------------------------------------------------------------------------- */

const toBytes = ([r, g, b]: readonly number[]): Rgb8 => [
  Math.round((r ?? 0) * 255),
  Math.round((g ?? 0) * 255),
  Math.round((b ?? 0) * 255),
];

const rampPaper = (ramp: AsciiLook["ramp"]): string => {
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.mainframe)[0];
  }
  return ramp?.[0] ?? RAMPS.mainframe[0];
};

/**
 * Braille and quadrants light a dot or leave it dark; blue-noise ordered
 * dithering keeps soft shading as a stipple instead of one hard edge.
 */
const packedDither = (look: AsciiLook): "none" | "blue-noise" => {
  const { kind } = resolveCharset(look.charset ?? "standard", look.chars);
  return kind === "braille" || kind === "quadrants" ? "blue-noise" : "none";
};

/**
 * On a light page, near-white glyphs vanish into the paper. Scale a
 * colour down so its luma stays at or under `limit`; dark pages pass 1.
 */
const capLuma = (out: Float64Array, limit: number) => {
  const value =
    (0.2126 * (out[1] ?? 0) + 0.7152 * (out[2] ?? 0) + 0.0722 * (out[3] ?? 0)) /
    255;
  if (value > limit) {
    const scale = limit / value;
    out[1] = (out[1] ?? 0) * scale;
    out[2] = (out[2] ?? 0) * scale;
    out[3] = (out[3] ?? 0) * scale;
  }
};

/** Ink, paper and map options for a look; phosphor and duotone bring their own glass. */
const sceneLook = (
  look: AsciiLook,
  theme: readonly (readonly number[])[] | null
) => {
  const transparent = look.background === "transparent";
  const themeInk = theme?.[0] ? toBytes(theme[0]) : ([230, 230, 230] as Rgb8);
  const themePaper = theme?.[1] ? toBytes(theme[1]) : ([10, 10, 10] as Rgb8);
  let ink: AsciiColor = "--ascii-ink";
  let paper: AsciiColor = "--ascii-paper";
  let palette: readonly Rgb8[] = [themePaper, themeInk];
  if (look.colorMode === "duotone") {
    paper = rampPaper(look.ramp);
    palette = [hexToRgb(paper), themeInk];
  } else if (look.phosphor && (look.colorMode ?? "mono") === "mono") {
    const preset = PHOSPHORS[look.phosphor];
    ({ ink } = preset);
    ({ paper } = preset);
    palette = [hexToRgb(preset.paper), hexToRgb(preset.ink)];
  }
  const options: MapOptions = {
    ansi: look.ansi,
    chars: look.chars,
    charset: look.charset,
    colorMode: look.colorMode,
    dither: look.dither ?? packedDither(look),
    edgeThreshold: look.edgeThreshold,
    grade: look.grade,
    invert: look.invert,
    palette,
    ramp: look.ramp,
    threshold: look.threshold,
  };
  // Phosphor and duotone glass is dark, so only the theme paper can be light.
  const lightPaper =
    paper === "--ascii-paper" &&
    (0.2126 * themePaper[0] + 0.7152 * themePaper[1] + 0.0722 * themePaper[2]) /
      255 >
      0.5;
  return {
    ink,
    lumaLimit: lightPaper ? 0.5 : 1,
    options,
    paper: transparent ? ("transparent" as const) : paper,
  };
};

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

const clamp01 = (value: number) => (value > 0 ? Math.min(value, 1) : 0);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const fract = (value: number) => value - Math.floor(value);

const hash3 = (x: number, y: number, z: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43_758.5453);

/** Smooth value noise in 3D, about -0.5 to 0.5. */
const noise3 = (x: number, y: number, z: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const corner = (dx: number, dy: number, dz: number) =>
    hash3(ix + dx, iy + dy, iz + dz);
  const front = lerp(
    lerp(corner(0, 0, 0), corner(1, 0, 0), sx),
    lerp(corner(0, 1, 0), corner(1, 1, 0), sx),
    sy
  );
  const back = lerp(
    lerp(corner(0, 0, 1), corner(1, 0, 1), sx),
    lerp(corner(0, 1, 1), corner(1, 1, 1), sx),
    sy
  );
  return lerp(front, back, sz) - 0.5;
};

interface Pulse {
  /** Smoothed 0..1 weights of each state, so changes cross-fade. */
  listening: number;
  speaking: number;
  bass: number;
  level: number;
  treble: number;
}

interface OrbFrame {
  time: number;
  morph: number;
  glow: number;
  leanX: number;
  leanY: number;
  pulse: Pulse;
  from: Rgb8;
  to: Rgb8;
}

/** Tone and colour at (u, v) in orb radii from the centre, y up. */
const shadeOrb = (orb: OrbFrame, u: number, v: number, out: Float64Array) => {
  const { time, pulse } = orb;
  const px = u - orb.leanX * 0.12;
  const py = v - orb.leanY * 0.12;
  const r = Math.hypot(px, py);
  const angle = Math.atan2(py, px);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  // The outline: slow harmonics and noise, a breath, then the state's motion.
  const wobble =
    0.03 * Math.sin(3 * angle + time * 0.7) +
    0.022 * Math.sin(5 * angle - time * 0.9 + 1.3) +
    0.06 * noise3(ca * 1.4, sa * 1.4, time * 0.25);
  const breath = 0.025 * Math.sin(time * 1.15);
  const lobes =
    pulse.speaking *
    (0.05 + 0.16 * pulse.bass) *
    (0.5 + 0.5 * Math.sin(4 * angle + time * 2.6));
  const swell = pulse.listening * (0.02 + 0.1 * pulse.level);
  const radius = 1 + orb.morph * wobble + breath + lobes + swell;

  const [fr, fg, fb] = orb.from;
  const [tr, tg, tb] = orb.to;
  // Colour drifts between the two around the rim and over time.
  const blend = 0.5 + 0.5 * Math.sin(angle * 1 + time * 0.45 + v * 1.2);

  if (r >= radius) {
    const outside = r - radius;
    let tone =
      orb.glow * 0.42 * Math.exp(-outside / 0.11) * (0.6 + 0.4 * pulse.level);
    // Speaking: rings travel outwards. Listening: they travel inwards.
    for (let ring = 0; ring < 3; ring += 1) {
      const outward = fract(time * 0.55 + ring / 3);
      const inward = 1 - outward;
      const out1 =
        Math.exp(-(((outside - outward * 0.55) / 0.018) ** 2)) * (1 - outward);
      const in1 =
        Math.exp(-(((outside - inward * 0.45) / 0.016) ** 2)) * inward * 0.8;
      tone +=
        pulse.speaking * out1 * (0.18 + 0.5 * pulse.level) +
        pulse.listening * in1 * (0.12 + 0.35 * pulse.level);
    }
    out[0] = clamp01(tone);
    out[1] = fr + (tr - fr) * blend;
    out[2] = fg + (tg - fg) * blend;
    out[3] = fb + (tb - fb) * blend;
    return;
  }

  const d = r / radius;
  const nz = Math.sqrt(Math.max(0, 1 - d * d));
  const nx = px / radius;
  const ny = py / radius;
  // Light from the upper left, pulled towards the pointer.
  let lx = -0.45 + orb.leanX * 0.35;
  let ly = 0.55 + orb.leanY * 0.35;
  let lz = 0.75;
  const inverse = 1 / Math.hypot(lx, ly, lz);
  lx *= inverse;
  ly *= inverse;
  lz *= inverse;
  const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
  const hz = lz + 1;
  const halfLength = Math.hypot(lx, ly, hz);
  const specular =
    Math.max(0, (nx * lx + ny * ly + nz * hz) / halfLength) ** 50;
  const rim = (1 - nz) ** 2.5;
  // Slow currents under the surface so the body never reads as flat.
  const swirl =
    noise3(nx * 2.2 + time * 0.12, ny * 2.2 - time * 0.08, time * 0.18) +
    0.5 * noise3(nx * 4.6, ny * 4.6, time * 0.3 + 4);
  const shimmer =
    pulse.speaking * pulse.treble * 0.25 * noise3(nx * 9, ny * 9, time * 3);
  const tone =
    0.1 +
    0.7 * diffuse ** 1.3 +
    0.32 * rim +
    0.2 * swirl * (0.4 + diffuse) +
    0.85 * specular +
    shimmer +
    0.15 * pulse.level;
  out[0] = clamp01(tone);
  const light = 0.25 + 0.85 * diffuse + 0.3 * rim;
  const white = specular * 255;
  out[1] = Math.min(255, (fr + (tr - fr) * blend) * light + white);
  out[2] = Math.min(255, (fg + (tg - fg) * blend) * light + white);
  out[3] = Math.min(255, (fb + (tb - fb) * blend) * light + white);
};

const isBands = (value: AsciiOrbProps["audio"]): value is AudioBands =>
  typeof value === "object" &&
  value !== null &&
  "bass" in value &&
  "status" in value;

const DEFAULT_COLORS = ["purple", "blue"] as const;

/**
 * A glyph orb for voice interfaces, shaded on the CPU. It breathes when
 * idle, swells with the input while listening and pulses with the bass
 * while speaking. Give it `audio` to drive it from a microphone or your
 * text-to-speech output.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiOrb = ({
  state = "idle",
  audio,
  colors = DEFAULT_COLORS,
  size = 0.62,
  morph = 1,
  lean = 1,
  glow = 0.6,
  speed = 1,
  cell = 10,
  animate = true,
  handle,
  charset = "dots",
  chars,
  colorMode = "truecolor",
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
  className,
  "aria-label": ariaLabel,
  ...props
}: AsciiOrbProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    colors[0],
    colors[1],
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const ownBands = useAudioBands(isBands(audio) ? null : (audio ?? null));
  const bands = isBands(audio) ? audio : ownBands;
  const fieldRef = useRef<ToneField | null>(null);
  const sample = useRef(new Float64Array(4));
  const pulse = useRef<Pulse>({
    bass: 0,
    level: 0,
    listening: state === "listening" ? 1 : 0,
    speaking: state === "speaking" ? 1 : 0,
    treble: 0,
  });
  const pointer = useRef({ eased: [0, 0], target: [0, 0] });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || lean === 0) {
      return;
    }
    const move = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      pointer.current.target = [
        Math.max(
          -1,
          Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1)
        ),
        Math.max(
          -1,
          Math.min(1, 1 - ((event.clientY - box.top) / box.height) * 2)
        ),
      ];
    };
    const leave = () => {
      pointer.current.target = [0, 0];
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [lean]);

  const look: AsciiLook = {
    ansi,
    background,
    chars,
    charset,
    colorMode,
    dither,
    edgeThreshold,
    grade,
    invert,
    phosphor,
    ramp,
    threshold,
  };
  const { ink, paper, options, lumaLimit } = sceneLook(look, theme);
  const resolved = resolveCharset(charset, chars);
  const from = theme?.[2] ? toBytes(theme[2]) : ([170, 110, 255] as Rgb8);
  const to = theme?.[3] ? toBytes(theme[3]) : ([70, 150, 255] as Rgb8);

  // oxlint-disable-next-line complexity -- one pass per frame: state easing, audio, pointer and the sample loop read best together.
  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const smooth = delta > 0 ? 1 - Math.exp(-delta * 5) : 1;
    const { current } = pulse;
    current.listening +=
      ((state === "listening" ? 1 : 0) - current.listening) * smooth;
    current.speaking +=
      ((state === "speaking" ? 1 : 0) - current.speaking) * smooth;
    const live = bands.status === "running";
    // Without audio, the active states still move: a soft synthetic level.
    const idleLevel = 0.35 + 0.25 * Math.sin(time * 3.1) * Math.sin(time * 1.3);
    current.level = live
      ? bands.level
      : idleLevel * (current.listening + current.speaking);
    current.bass = live ? bands.bass : idleLevel * current.speaking;
    current.treble = live ? bands.treble : 0.3 * current.speaking;
    const { eased, target } = pointer.current;
    const follow = delta > 0 ? 1 - Math.exp(-delta * 3) : 1;
    eased[0] = (eased[0] ?? 0) + ((target[0] ?? 0) - (eased[0] ?? 0)) * follow;
    eased[1] = (eased[1] ?? 0) + ((target[1] ?? 0) - (eased[1] ?? 0)) * follow;

    const [gx, gy] = resolved.grid;
    let field = fieldRef.current;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
    }
    const box = rootRef.current;
    const width = box?.clientWidth || columns * metrics.width;
    const height = box?.clientHeight || rows * metrics.height;
    const radius =
      (Math.min(width, height) / 2) * Math.min(0.9, Math.max(0.2, size));
    const orb: OrbFrame = {
      from,
      glow: clamp01(glow),
      leanX: (eased[0] ?? 0) * lean * (reducedMotion ? 0 : 1),
      leanY: (eased[1] ?? 0) * lean * (reducedMotion ? 0 : 1),
      morph,
      pulse: current,
      time,
      to,
    };
    const sampleWidth = metrics.width / gx;
    const sampleHeight = metrics.height / gy;
    const { tones } = field;
    const fieldColors = field.colors;
    const out = sample.current;
    for (let y = 0; y < field.height; y += 1) {
      const v = (height / 2 - (y + 0.5) * sampleHeight) / radius;
      for (let x = 0; x < field.width; x += 1) {
        const u = ((x + 0.5) * sampleWidth - width / 2) / radius;
        // Far outside the halo there is nothing to shade.
        if (u * u + v * v > 3.2) {
          tones[y * field.width + x] = 0;
          continue;
        }
        shadeOrb(orb, u, v, out);
        if (lumaLimit < 1) {
          capLuma(out, lumaLimit);
        }
        const index = y * field.width + x;
        tones[index] = out[0] ?? 0;
        if (fieldColors) {
          const at = index * 4;
          fieldColors[at] = out[1] ?? 0;
          fieldColors[at + 1] = out[2] ?? 0;
          fieldColors[at + 2] = out[3] ?? 0;
          fieldColors[at + 3] = 255;
        }
      }
    }
    mapTones(field, columns, rows, options, frame);
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel ?? `Voice assistant, ${state}`}
      data-state={state}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <AsciiGrid
        draw={draw}
        cell={cell}
        ink={ink}
        paper={paper}
        colored={colorMode !== "mono"}
        animate={animate}
        speed={speed}
        fps={60}
        stillTime={2}
        handle={handle}
        className="absolute inset-0"
      />
      {fx ? <CrtOverlay fx={fx} /> : null}
    </div>
  );
};

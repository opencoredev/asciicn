"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ComponentProps,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from "react";

import {
  AsciiGrid,
  createToneField,
  mapTones,
  resolveCharset,
  useAsciiColors,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  CellMetrics,
  Charset,
  Rgba,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface AsciiCanvasProps
  extends
    Pick<AsciiLook, "charset" | "chars">,
    Omit<ComponentProps<"div">, "children"> {
  /** Which glyphs draw the ink. Default `"standard"`. */
  charset?: AsciiLook["charset"];
  /** Brush radius in cells. Default 1.25. */
  brushSize?: number;
  /** Seconds for a trail to fade to about a third. Default 1.8. */
  decay?: number;
  /** How fast ink spreads into its neighbours, 0 to 1. Default 0.5. */
  diffusion?: number;
  /** How much trails curl and drift as they fade, 0 to 1. Default 0.35. */
  swirl?: number;
  /** Clicks and taps send ripples that bend the ink. Default `true`. */
  ripples?: boolean;
  /** A slow ghost brush paints while nobody is drawing. Default `true`. */
  idle?: boolean;
  /** Ink colours. Each new stroke takes the next one. Default `["--ascii-ink"]`. */
  inks?: readonly AsciiColor[];
  /** Show the clear button. Default `true`. */
  clearButton?: boolean;
  /** A short how-to in the corner until the first stroke. `false` hides it. Default `"drag to paint · click to ripple"`. */
  hint?: string | false;
  /** Background behind the glyphs. Default `"paper"`. */
  background?: AsciiLook["background"];
  /** Cell height in CSS pixels. Default 12. */
  cell?: number;
  /** Simulation speed multiplier. Default 1. */
  speed?: number;
  /** `false` freezes fading, spreading and the idle brush; painting still works. Default `true`. */
  animate?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const DEFAULT_INKS: readonly AsciiColor[] = ["--ascii-ink"];

/** Simulation steps per second; slower frames run several. */
const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Seconds the pad waits after the visitor stops before the ghost brush returns. */
const IDLE_AFTER = 4;
/** Seconds of ghost brush simulated before the first frame, so it never starts blank. */
const WARM_UP = 1.6;
/** Ink saturates here; above 1 a core stays bright for longer as it fades. */
const INK_MAX = 1.6;

type PadEvent =
  | {
      readonly kind: "stroke";
      /** From and to, in CSS pixels from the pad's top-left. */
      readonly x0: number;
      readonly y0: number;
      readonly x1: number;
      readonly y1: number;
      readonly flow: number;
      readonly ink: number;
    }
  | {
      readonly kind: "ripple";
      readonly x: number;
      readonly y: number;
      readonly strength: number;
    };

/** Everything the simulation keeps between frames, sized to the sample grid. */
interface Simulation {
  width: number;
  height: number;
  /** CSS pixels per sample. */
  sampleWidth: number;
  sampleHeight: number;
  ink: Float32Array;
  next: Float32Array;
  /** Ink colour per sample, as palette weights mixed by diffusion. */
  dye: Float32Array;
  dyeNext: Float32Array;
  wave: Float32Array;
  wavePrevious: Float32Array;
  field: ToneField;
  /** Seconds of simulation left over from the last frame. */
  carry: number;
  clock: number;
  /** Seconds of fast fading left after "clear". */
  clearing: number;
  ghost: { x: number; y: number; ink: number; ripple: number } | null;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const createSimulation = (
  columns: number,
  rows: number,
  charset: Charset,
  { width: cellWidth, height: cellHeight }: CellMetrics
): Simulation => {
  const field = createToneField(columns, rows, charset);
  const size = field.width * field.height;
  const [gx, gy] = charset.grid;
  return {
    carry: 0,
    clearing: 0,
    clock: 0,
    dye: new Float32Array(size),
    dyeNext: new Float32Array(size),
    field,
    ghost: null,
    height: field.height,
    ink: new Float32Array(size),
    next: new Float32Array(size),
    sampleHeight: cellHeight / gy,
    sampleWidth: cellWidth / gx,
    wave: new Float32Array(size),
    wavePrevious: new Float32Array(size),
    width: field.width,
  };
};

/** Lay a soft round dab of ink along a segment, in CSS pixels. */
const stamp = (
  sim: Simulation,
  event: Extract<PadEvent, { kind: "stroke" }>,
  radius: number
) => {
  const { width, height, sampleWidth, sampleHeight, ink, dye } = sim;
  const length = Math.hypot(event.x1 - event.x0, event.y1 - event.y0);
  // Dabs closer than a third of the radius, so fast strokes stay unbroken.
  const dabs = Math.max(1, Math.ceil(length / Math.max(1, radius * 0.33)));
  const sigma = radius * 0.5;
  const reach = radius * 1.4;
  // Many dabs overlap on a slow stroke, so each one lays down less.
  const flow = event.flow * Math.min(1, 0.45 + length / (radius * 6));
  for (let dab = 0; dab < dabs; dab += 1) {
    const t = dabs === 1 ? 1 : (dab + 1) / dabs;
    const cx = event.x0 + (event.x1 - event.x0) * t;
    const cy = event.y0 + (event.y1 - event.y0) * t;
    const left = Math.max(0, Math.floor((cx - reach) / sampleWidth));
    const right = Math.min(width - 1, Math.ceil((cx + reach) / sampleWidth));
    const top = Math.max(0, Math.floor((cy - reach) / sampleHeight));
    const bottom = Math.min(height - 1, Math.ceil((cy + reach) / sampleHeight));
    for (let y = top; y <= bottom; y += 1) {
      const dy = (y + 0.5) * sampleHeight - cy;
      for (let x = left; x <= right; x += 1) {
        const dx = (x + 0.5) * sampleWidth - cx;
        const weight =
          flow * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        if (weight < 0.004) {
          continue;
        }
        const index = y * width + x;
        const before = ink[index] ?? 0;
        const added = (INK_MAX - before) * weight * 0.7;
        ink[index] = before + added;
        // The new ink tints the sample in proportion to how much it adds.
        const share = added / Math.max(1e-4, before + added);
        dye[index] =
          (dye[index] ?? 0) + (event.ink - (dye[index] ?? 0)) * share;
      }
    }
  }
};

/** Push the water down in a small disc; the wave step turns it into a ring. */
const splash = (
  sim: Simulation,
  event: Extract<PadEvent, { kind: "ripple" }>,
  radius: number
) => {
  const { width, height, sampleWidth, sampleHeight, wave } = sim;
  const left = Math.max(0, Math.floor((event.x - radius) / sampleWidth));
  const right = Math.min(
    width - 1,
    Math.ceil((event.x + radius) / sampleWidth)
  );
  const top = Math.max(0, Math.floor((event.y - radius) / sampleHeight));
  const bottom = Math.min(
    height - 1,
    Math.ceil((event.y + radius) / sampleHeight)
  );
  for (let y = top; y <= bottom; y += 1) {
    const dy = ((y + 0.5) * sampleHeight - event.y) / radius;
    for (let x = left; x <= right; x += 1) {
      const dx = ((x + 0.5) * sampleWidth - event.x) / radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        const index = y * width + x;
        wave[index] =
          (wave[index] ?? 0) -
          event.strength * (1 + Math.cos(Math.PI * Math.sqrt(d2))) * 0.5;
      }
    }
  }
};

/**
 * A slow flow of eddies at a point, in pixels per step before `swirl`.
 * It is the curl of a moving sum of sines, so it turns ink without
 * bunching or thinning it, plus a slight rise, like warm air.
 */
const eddies = (x: number, y: number, t: number): readonly [number, number] => {
  const a = 0.018;
  const b = 0.041;
  // Stream function psi = sin(ax + .5t) sin(ay - .4t) + .5 sin(bx - .7t) sin(by + .6t);
  // velocity is (d psi / dy, -d psi / dx).
  const vx =
    Math.sin(a * x + 0.5 * t) * Math.cos(a * y - 0.4 * t) * 60 * a +
    Math.sin(b * x - 0.7 * t) * Math.cos(b * y + 0.6 * t) * 30 * b;
  const vy =
    -Math.cos(a * x + 0.5 * t) * Math.sin(a * y - 0.4 * t) * 60 * a -
    Math.cos(b * x - 0.7 * t) * Math.sin(b * y + 0.6 * t) * 30 * b -
    0.25;
  return [vx, vy];
};

interface StepOptions {
  readonly decay: number;
  readonly diffusion: number;
  readonly swirl: number;
}

/**
 * One fixed step of ink: it fades, spreads and drifts on a slow curling
 * flow. Spreading uses per-axis weights because samples aren't square (a
 * classic cell is about 0.6 wide for 1 tall), so trails stay round.
 */
const stepInk = (sim: Simulation, options: StepOptions) => {
  const { width, height, sampleWidth, sampleHeight } = sim;
  const { ink, next, dye, dyeNext } = sim;
  sim.clock += STEP;
  const fade = Math.exp(
    -STEP / Math.max(0.05, sim.clearing > 0 ? 0.12 : options.decay)
  );
  sim.clearing = Math.max(0, sim.clearing - STEP);

  // Diffusion, stable while kx + ky stays under a quarter. Kept well
  // under it: fast spreading flattens a trail's bright core.
  const spread =
    (clamp(options.diffusion, 0, 1) * 0.12) /
    (1 / sampleWidth ** 2 + 1 / sampleHeight ** 2);
  const kx = spread / sampleWidth ** 2;
  const ky = spread / sampleHeight ** 2;

  // Eddies move at most about a pixel per step at full swirl.
  const drift = clamp(options.swirl, 0, 1) * 0.6;
  const t = sim.clock;

  for (let y = 0; y < height; y += 1) {
    const up = (y > 0 ? y - 1 : y) * width;
    const down = (y < height - 1 ? y + 1 : y) * width;
    const row = y * width;
    const py = (y + 0.5) * sampleHeight;
    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      const left = row + (x > 0 ? x - 1 : x);
      const right = row + (x < width - 1 ? x + 1 : x);
      const centre = ink[index] ?? 0;
      let moved = centre;
      let tint = dye[index] ?? 0;
      if (drift > 0) {
        const px = (x + 0.5) * sampleWidth;
        const [vx, vy] = eddies(px, py, t);
        // Back-trace one step along the flow and read the ink there,
        // blended between the four samples around it.
        const sx = clamp(x - (vx * drift) / sampleWidth, 0, width - 1);
        const sy = clamp(y - (vy * drift) / sampleHeight, 0, height - 1);
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(width - 1, x0 + 1);
        const y1 = Math.min(height - 1, y0 + 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const top =
          (ink[y0 * width + x0] ?? 0) * (1 - fx) +
          (ink[y0 * width + x1] ?? 0) * fx;
        const bottom =
          (ink[y1 * width + x0] ?? 0) * (1 - fx) +
          (ink[y1 * width + x1] ?? 0) * fx;
        moved = top * (1 - fy) + bottom * fy;
        tint = dye[Math.round(sy) * width + Math.round(sx)] ?? tint;
      }
      const lap =
        kx * ((ink[left] ?? 0) + (ink[right] ?? 0) - 2 * centre) +
        ky * ((ink[up + x] ?? 0) + (ink[down + x] ?? 0) - 2 * centre);
      next[index] = Math.max(0, (moved + lap) * fade);
      dyeNext[index] = tint;
    }
  }
  sim.ink = next;
  sim.next = ink;
  sim.dye = dyeNext;
  sim.dyeNext = dye;
};

/**
 * Two substeps of a damped leapfrog wave equation, with per-axis weights
 * so rings stay round on non-square samples. Stable while wx + wy < 0.5.
 */
const stepWaves = (sim: Simulation) => {
  const { width, height, sampleWidth, sampleHeight } = sim;
  const speed = Math.min(
    1.6,
    Math.sqrt(0.45 / (1 / sampleWidth ** 2 + 1 / sampleHeight ** 2))
  );
  const wx = speed ** 2 / sampleWidth ** 2;
  const wy = speed ** 2 / sampleHeight ** 2;
  for (let pass = 0; pass < 2; pass += 1) {
    const current = sim.wave;
    const previous = sim.wavePrevious;
    for (let y = 0; y < height; y += 1) {
      const up = (y > 0 ? y - 1 : y) * width;
      const down = (y < height - 1 ? y + 1 : y) * width;
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        const index = row + x;
        const h = current[index] ?? 0;
        const lap =
          wx *
            ((current[row + (x > 0 ? x - 1 : x)] ?? 0) +
              (current[row + (x < width - 1 ? x + 1 : x)] ?? 0) -
              2 * h) +
          wy * ((current[up + x] ?? 0) + (current[down + x] ?? 0) - 2 * h);
        // Written over the previous surface, which is no longer needed.
        previous[index] = (2 * h - (previous[index] ?? 0) + lap) * 0.988;
      }
    }
    sim.wave = previous;
    sim.wavePrevious = current;
  }
};

const advance = (sim: Simulation, options: StepOptions) => {
  stepInk(sim, options);
  stepWaves(sim);
};

/** Lay queued strokes and splashes into the simulation, then empty the queue. */
const applyEvents = (
  sim: Simulation,
  queue: PadEvent[],
  {
    radius,
    splashRadius,
    ripples,
  }: { radius: number; splashRadius: number; ripples: boolean }
) => {
  for (const event of queue) {
    if (event.kind === "stroke") {
      stamp(sim, event, radius);
    } else if (ripples) {
      splash(sim, event, splashRadius);
    }
  }
  queue.length = 0;
};

/**
 * Tones: the ink, seen through the water. The surface slope shifts which
 * sample shows, so ripples bend the trails, and crests glint.
 */
const shadeTones = (sim: Simulation) => {
  const { width, height, ink, wave, field } = sim;
  const { tones } = field;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const above = Math.max(0, y - 1) * width;
    const below = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      const slopeX =
        (wave[row + Math.min(width - 1, x + 1)] ?? 0) -
        (wave[row + Math.max(0, x - 1)] ?? 0);
      const slopeY = (wave[below + x] ?? 0) - (wave[above + x] ?? 0);
      const sx = clamp(Math.round(x + slopeX * 6), 0, width - 1);
      const sy = clamp(Math.round(y + slopeY * 6), 0, height - 1);
      // A soft knee: thin ink still glows, and the faintest wisps drop out.
      const glow = 1 - Math.exp(-2.4 * (ink[sy * width + sx] ?? 0));
      const seen = Math.max(0, (glow - 0.06) / 0.94);
      const crest = Math.max(0, (wave[index] ?? 0) * 1.4);
      tones[index] = Math.min(1, seen + crest * (1 - seen));
    }
  }
};

/** Where the ghost brush is at time `t`, as a fraction of the pad. */
const ghostPath = (t: number): readonly [number, number] => [
  0.5 + 0.36 * Math.sin(t * 0.53 + 0.4) + 0.08 * Math.sin(t * 1.9),
  0.5 + 0.3 * Math.sin(t * 0.79 + 1.1) + 0.07 * Math.cos(t * 2.3),
];

/** Move the ghost brush one step and queue what it paints. */
const moveGhost = (
  sim: Simulation,
  queue: PadEvent[],
  box: { width: number; height: number },
  inkCount: number,
  ripples: boolean
) => {
  const t = sim.clock * 1.15;
  const [u, v] = ghostPath(t);
  const x = u * box.width;
  const y = v * box.height;
  const ghost = sim.ghost ?? { ink: 0, ripple: 1.2, x, y };
  // A new colour every few seconds, so a palette shows itself while idle.
  const ink = Math.floor(t / 3.2) % Math.max(1, inkCount);
  queue.push({
    flow: 0.55,
    ink,
    kind: "stroke",
    x0: ghost.x,
    x1: x,
    y0: ghost.y,
    y1: y,
  });
  ghost.ripple -= STEP;
  if (ghost.ripple <= 0 && ripples) {
    queue.push({ kind: "ripple", strength: 0.9, x, y });
    ghost.ripple = 2.8;
  }
  sim.ghost = { ...ghost, ink, x, y };
};

/**
 * Per-cell colour: the strokes' inks mixed by how much of each landed
 * there, and an alpha that follows the cell's brightest sample, so faint
 * tails glow dimmer than the cores instead of only thinning out.
 */
const paintColors = (
  colors: Uint8ClampedArray | null,
  sim: Simulation,
  columns: number,
  rows: number,
  charset: Charset,
  palette: readonly Rgba[] | null
) => {
  if (!colors) {
    return;
  }
  const [gx, gy] = charset.grid;
  const { width, ink, dye, field } = sim;
  const count = palette?.length ?? 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let peak = 0;
      let weight = 0;
      let mix = 0;
      for (let dy = 0; dy < gy; dy += 1) {
        for (let dx = 0; dx < gx; dx += 1) {
          const index = (row * gy + dy) * width + column * gx + dx;
          const tone = field.tones[index] ?? 0;
          const amount = ink[index] ?? 0;
          peak = Math.max(peak, tone);
          weight += amount;
          mix += (dye[index] ?? 0) * amount;
        }
      }
      // Dye is a position along the palette, so two inks blend through it.
      const along = weight > 1e-3 ? mix / weight : 0;
      const low = Math.floor(along);
      const blend = along - low;
      const a = palette?.[clamp(low, 0, count - 1)];
      const b = palette?.[clamp(low + 1, 0, count - 1)] ?? a;
      const at = (row * columns + column) * 4;
      const channel = (i: 0 | 1 | 2) =>
        ((a?.[i] ?? 1) * (1 - blend) + (b?.[i] ?? 1) * blend) * 255;
      colors[at] = channel(0);
      colors[at + 1] = channel(1);
      colors[at + 2] = channel(2);
      colors[at + 3] = Math.round(255 * (0.3 + 0.7 * Math.sqrt(peak)));
    }
  }
};

/**
 * An interactive glyph pad. The pointer paints ink into a tone grid that
 * spreads, curls and fades, so drags leave glowing trails of glyphs and
 * clicks send ripples that bend them. Works with mouse, pen and touch.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiCanvas = ({
  charset = "standard",
  chars,
  brushSize = 1.25,
  decay = 1.8,
  diffusion = 0.5,
  swirl = 0.35,
  ripples = true,
  idle = true,
  inks = DEFAULT_INKS,
  clearButton = true,
  hint = "drag to paint · click to ripple",
  background = "paper",
  cell = 12,
  speed = 1,
  animate = true,
  handle,
  className,
  "aria-label":
    ariaLabel = "Glyph pad. Drag to paint with glyphs; click to send a ripple. Arrow keys paint, space sends a ripple.",
  ...rest
}: AsciiCanvasProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const queueRef = useRef<PadEvent[]>([]);
  const pointerRef = useRef({
    down: false,
    ink: 0,
    lastActive: Number.NEGATIVE_INFINITY,
    strokes: 0,
    x: Number.NaN,
    y: Number.NaN,
  });
  const reducedMotion = usePrefersReducedMotion();
  const moving = animate && !reducedMotion;
  const colors = useAsciiColors(rootRef, inks);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("");
  // Under reduced motion nothing loops, so each stroke asks for one redraw.
  const [, setRedraw] = useState(0);
  const redrawQueued = useRef(false);
  const requestRedraw = () => {
    if (moving || redrawQueued.current) {
      return;
    }
    redrawQueued.current = true;
    requestAnimationFrame(() => {
      redrawQueued.current = false;
      setRedraw((value) => value + 1);
    });
  };

  const resolved = resolveCharset(charset, chars);
  const packed = resolved.kind === "braille" || resolved.kind === "quadrants";

  const draw = (context: AsciiGridDrawContext) => {
    const { columns, rows, metrics, frame, delta } = context;
    const [gx, gy] = resolved.grid;
    const box = {
      height: rows * metrics.height,
      width: columns * metrics.width,
    };
    const step = { decay, diffusion, swirl };
    const brush = {
      radius: Math.max(0.5, brushSize) * metrics.height,
      ripples,
      splashRadius: metrics.height * 1.2,
    };
    let sim = simRef.current;
    if (
      sim?.width !== columns * gx ||
      sim.height !== rows * gy ||
      sim.sampleHeight !== metrics.height / gy
    ) {
      sim = createSimulation(columns, rows, resolved, metrics);
      simRef.current = sim;
      // Paint a stroke before the first frame so the pad opens mid-gesture.
      const warm: PadEvent[] = [];
      for (let tick = 0; tick < WARM_UP / STEP; tick += 1) {
        moveGhost(sim, warm, box, inks.length, ripples && moving);
        applyEvents(sim, warm, brush);
        advance(sim, step);
      }
    }

    const resting =
      performance.now() / 1000 - pointerRef.current.lastActive > IDLE_AFTER;
    if (delta > 0) {
      sim.carry = Math.min(sim.carry + delta, STEP * MAX_STEPS);
    }
    const queue = queueRef.current;
    while (sim.carry >= STEP) {
      sim.carry -= STEP;
      if (idle && resting) {
        moveGhost(sim, queue, box, inks.length, ripples);
      } else {
        sim.ghost = null;
      }
      applyEvents(sim, queue, brush);
      advance(sim, step);
    }
    // Still frames (reduced motion, animate off) take strokes but not splashes.
    applyEvents(sim, queue, { ...brush, ripples: ripples && moving });
    shadeTones(sim);

    mapTones(
      sim.field,
      columns,
      rows,
      {
        chars,
        charset: resolved,
        colorMode: "truecolor",
        dither: packed ? "blue-noise" : "none",
      },
      frame
    );
    paintColors(frame.colors, sim, columns, rows, resolved, colors);
  };

  /* Input -------------------------------------------------------------- */

  const locate = (event: { clientX: number; clientY: number }) => {
    const box = rootRef.current?.getBoundingClientRect();
    return box
      ? { x: event.clientX - box.left, y: event.clientY - box.top }
      : { x: 0, y: 0 };
  };

  const touch = () => {
    pointerRef.current.lastActive = performance.now() / 1000;
    if (!touched) {
      setTouched(true);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }
    // A press on the clear button is not a brush stroke.
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }
    // Capture keeps the drag going past the edge. It throws if the pointer
    // is already gone (a very short tap), and the gesture works without it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture.
    }
    // The mousedown is cancelled below so a drag never selects page text;
    // that also skips the browser's focus, so take it here.
    event.currentTarget.focus({ preventScroll: true });
    const pointer = pointerRef.current;
    const { x, y } = locate(event);
    pointer.down = true;
    pointer.strokes += 1;
    pointer.ink = (pointer.strokes - 1) % Math.max(1, inks.length);
    pointer.x = x;
    pointer.y = y;
    queueRef.current.push(
      {
        flow: 0.9,
        ink: pointer.ink,
        kind: "stroke",
        x0: x,
        x1: x,
        y0: y,
        y1: y,
      },
      { kind: "ripple", strength: 1.6, x, y }
    );
    touch();
    requestRedraw();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    // A mouse paints faintly just by moving; touch and pen paint while down.
    // Hover ink only makes sense while it fades, and never under the button.
    const overButton =
      event.target instanceof Element && event.target.closest("button");
    const hovering =
      moving && !pointer.down && !overButton && event.pointerType === "mouse";
    if (!(pointer.down || hovering)) {
      // Start the next hover stroke fresh rather than joining it to this spot.
      pointer.x = Number.NaN;
      pointer.y = Number.NaN;
      return;
    }
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = samples.length > 0 ? samples : [event.nativeEvent];
    for (const point of points) {
      const { x, y } = locate(point);
      if (!Number.isNaN(pointer.x)) {
        queueRef.current.push({
          flow: pointer.down ? 0.9 : 0.28,
          ink: pointer.ink,
          kind: "stroke",
          x0: pointer.x,
          x1: x,
          y0: pointer.y,
          y1: y,
        });
      }
      pointer.x = x;
      pointer.y = y;
    }
    touch();
    requestRedraw();
  };

  const onPointerEnd = () => {
    pointerRef.current.down = false;
  };
  const onPointerLeave = () => {
    const pointer = pointerRef.current;
    if (!pointer.down) {
      pointer.x = Number.NaN;
      pointer.y = Number.NaN;
    }
  };

  // Keyboard: arrows move a brush from the centre, space or enter splash.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || event.target !== event.currentTarget) {
      return;
    }
    const pointer = pointerRef.current;
    if (Number.isNaN(pointer.x)) {
      pointer.x = box.width / 2;
      pointer.y = box.height / 2;
    }
    const step = cell * (event.shiftKey ? 3 : 1);
    const moves: Record<string, readonly [number, number]> = {
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const x = clamp(pointer.x + move[0], 0, box.width);
      const y = clamp(pointer.y + move[1], 0, box.height);
      queueRef.current.push({
        flow: 0.9,
        ink: pointer.ink,
        kind: "stroke",
        x0: pointer.x,
        x1: x,
        y0: pointer.y,
        y1: y,
      });
      pointer.x = x;
      pointer.y = y;
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      pointer.strokes += 1;
      pointer.ink = (pointer.strokes - 1) % Math.max(1, inks.length);
      queueRef.current.push({
        kind: "ripple",
        strength: 1.6,
        x: pointer.x,
        y: pointer.y,
      });
    } else {
      return;
    }
    touch();
    requestRedraw();
  };

  const clear = () => {
    const sim = simRef.current;
    if (sim) {
      if (moving) {
        // Evaporate quickly rather than vanish, so the clear reads as motion.
        sim.clearing = 0.45;
      } else {
        sim.ink.fill(0);
      }
      sim.wave.fill(0);
      sim.wavePrevious.fill(0);
      sim.ghost = null;
    }
    pointerRef.current.lastActive = performance.now() / 1000;
    setStatus("Pad cleared");
    requestRedraw();
  };

  useEffect(() => {
    if (status === "") {
      return;
    }
    const timer = window.setTimeout(() => setStatus(""), 1500);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <div
      ref={rootRef}
      role="application"
      aria-roledescription="glyph pad"
      aria-label={ariaLabel}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the pad takes arrow keys and space, so it needs focus.
      tabIndex={0}
      className={cn(
        "group/pad relative cursor-crosshair touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onPointerDown={onPointerDown}
      onMouseDown={(event) => {
        if (
          !(event.target instanceof Element && event.target.closest("button"))
        ) {
          event.preventDefault();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      {...rest}
    >
      <AsciiGrid
        draw={draw}
        cell={cell}
        paper={background === "transparent" ? "transparent" : "--ascii-paper"}
        colored
        speed={speed}
        animate={moving}
        fps={60}
        handle={handle}
        className="absolute inset-0"
      />
      {hint && !touched ? (
        <p className="pointer-events-none absolute top-2 left-3 font-mono text-[11px] leading-4 text-[var(--ascii-ink)] opacity-60">
          {hint}
        </p>
      ) : null}
      {clearButton ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 bottom-2 border border-[var(--ascii-ink)]/30 bg-[var(--ascii-paper)]/85 px-2 py-1 font-mono text-[11px] leading-none text-[var(--ascii-ink)] outline-none transition-[border-color,transform] duration-150 ease-out hover:border-[var(--ascii-ink)]/70 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none"
        >
          ⌫ clear
        </button>
      ) : null}
      <p className="sr-only" role="status">
        {status}
      </p>
    </div>
  );
};

"use client";

/**
 * Helpers for the Studio's media sources (image, video, webcam, text): the
 * text banner raster, and the pointer effects the GPU renderer has built
 * in, redone on the CPU so media sources react the same way. Sampling
 * itself is the engine's `sampleToField`.
 */

import type { StudioCharset, TextFont } from "@/components/studio/state";
import { resolveCharset } from "@/lib/ascii/charsets";
import type { Charset } from "@/lib/ascii/charsets";
import type { ToneField } from "@/lib/ascii/frame";
import type { Interaction } from "@/lib/ascii/look";

/** The charset a Studio look draws with: a named set or the custom ramp. */
export const studioCharset = (charset: StudioCharset, chars: string): Charset =>
  charset === "custom"
    ? resolveCharset("standard", chars)
    : resolveCharset(charset);

const FONT_STACKS: Readonly<Record<TextFont, string>> = {
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
};

export interface BannerOptions {
  readonly text: string;
  readonly font: TextFont;
  readonly weight: number;
  /** Width over height of the stage, in CSS pixels. */
  readonly aspect: number;
}

/**
 * Draw `text` as large as it fits, white on black, into a canvas with the
 * stage's shape. Each line of `text` is a row.
 */
export const drawBanner = (
  canvas: HTMLCanvasElement,
  { text, font, weight, aspect }: BannerOptions
): void => {
  const height = 480;
  const width = Math.max(64, Math.round(height * aspect));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return;
  }
  const family = FONT_STACKS[font];
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff";
  const probe = 100;
  context.font = `${weight} ${probe}px ${family}`;
  const widest = Math.max(
    ...lines.map((line) => context.measureText(line).width)
  );
  const lineHeight = 1.05;
  const size = Math.min(
    (width * 0.88 * probe) / Math.max(1, widest),
    (height * 0.8) / (lines.length * lineHeight)
  );
  context.font = `${weight} ${size}px ${family}`;
  const top = height / 2 - ((lines.length - 1) * size * lineHeight) / 2;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, width / 2, top + index * size * lineHeight);
  }
};

/** Pointer state for the CPU interaction effects, in sample units. */
export interface InteractionState {
  /** Fading ink left by the pointer, for `trail`. */
  trail: Float32Array;
  width: number;
  height: number;
  /** Clicks still rippling, with the time they started. */
  ripples: { x: number; y: number; at: number }[];
  wasDown: boolean;
}

export const createInteractionState = (): InteractionState => ({
  height: 0,
  ripples: [],
  trail: new Float32Array(0),
  wasDown: false,
  width: 0,
});

export interface PointerSample {
  /** Pointer position in cells, fractional. */
  readonly x: number;
  readonly y: number;
  readonly inside: boolean;
  readonly down: boolean;
}

/** Where the pointer is on the sample grid, and how to keep distances round. */
interface Probe {
  readonly x: number;
  readonly y: number;
  /** Samples are not square: scale x by this so circles stay round. */
  readonly xScale: number;
}

const RIPPLE_SECONDS = 2.4;

const clampIndex = (value: number, size: number) =>
  Math.min(size - 1, Math.max(0, value));

/** Push the picture away from the pointer, strongest at its centre. */
const repel = (field: ToneField, probe: Probe) => {
  const { width, height, tones } = field;
  const radius = height * 0.22;
  const source = [...tones];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - probe.x) * probe.xScale;
      const dy = y - probe.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < radius) {
        const push = (1 - distance / radius) ** 2 * radius * 0.6;
        const sx = clampIndex(
          Math.round(x - (dx / distance) * (push / probe.xScale)),
          width
        );
        const sy = clampIndex(Math.round(y - (dy / distance) * push), height);
        tones[y * width + x] = source[sy * width + sx] ?? 0;
      }
    }
  }
};

/** Brighten a thin ring around each recent click as it spreads and fades. */
const ripple = (
  field: ToneField,
  state: InteractionState,
  probe: Probe,
  time: number
) => {
  const { width, height, tones } = field;
  state.ripples = state.ripples.filter(
    (item) => time >= item.at && time - item.at < RIPPLE_SECONDS
  );
  for (const item of state.ripples) {
    const age = time - item.at;
    const front = age * height * 0.55;
    const fade = 1 - age / RIPPLE_SECONDS;
    const band = height * 0.03;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const distance = Math.hypot((x - item.x) * probe.xScale, y - item.y);
        const ring = Math.exp(-(((distance - front) / band) ** 2));
        const index = y * width + x;
        tones[index] = Math.min(1, (tones[index] ?? 0) + ring * fade * 0.8);
      }
    }
  }
};

/** Leave ink where the pointer passes, fading over about a second. */
const trail = (
  field: ToneField,
  state: InteractionState,
  probe: Probe,
  inside: boolean,
  delta: number
) => {
  const { width, height, tones } = field;
  const wake = state.trail;
  const decay = Math.exp(-Math.max(0, delta) * 1.6);
  for (let index = 0; index < wake.length; index += 1) {
    wake[index] = (wake[index] ?? 0) * decay;
  }
  if (inside) {
    const radius = Math.max(2, height * 0.05);
    const reachY = Math.ceil(radius * 2);
    const reachX = Math.ceil(reachY / probe.xScale);
    const fromY = Math.max(0, Math.floor(probe.y - reachY));
    const toY = Math.min(height - 1, Math.ceil(probe.y + reachY));
    const fromX = Math.max(0, Math.floor(probe.x - reachX));
    const toX = Math.min(width - 1, Math.ceil(probe.x + reachX));
    for (let y = fromY; y <= toY; y += 1) {
      for (let x = fromX; x <= toX; x += 1) {
        const distance = Math.hypot((x - probe.x) * probe.xScale, y - probe.y);
        const index = y * width + x;
        wake[index] = Math.max(
          wake[index] ?? 0,
          Math.exp(-((distance / radius) ** 2))
        );
      }
    }
  }
  for (let index = 0; index < tones.length; index += 1) {
    tones[index] = Math.max(tones[index] ?? 0, wake[index] ?? 0);
  }
};

export interface InteractionInput {
  readonly interaction: Interaction;
  readonly pointer: PointerSample;
  /** The charset's samples per cell. */
  readonly grid: readonly [number, number];
  /** Cell width over height. */
  readonly cellAspect: number;
  readonly time: number;
  readonly delta: number;
}

/**
 * Apply an interaction to a sampled field in place: `repel` pushes the
 * picture away from the pointer, `ripple` sends rings out from each click,
 * `trail` leaves a fading wake of ink.
 */
export const applyInteraction = (
  field: ToneField,
  state: InteractionState,
  { interaction, pointer, grid, cellAspect, time, delta }: InteractionInput
): void => {
  if (state.width !== field.width || state.height !== field.height) {
    state.trail = new Float32Array(field.width * field.height);
    state.width = field.width;
    state.height = field.height;
    state.ripples = [];
  }
  const probe: Probe = {
    x: pointer.x * grid[0],
    xScale: (cellAspect * grid[1]) / grid[0],
    y: pointer.y * grid[1],
  };
  if (pointer.down && !state.wasDown && pointer.inside) {
    state.ripples.push({ at: time, x: probe.x, y: probe.y });
  }
  state.wasDown = pointer.down;

  switch (interaction) {
    case "repel": {
      if (pointer.inside) {
        repel(field, probe);
      }
      break;
    }
    case "ripple": {
      ripple(field, state, probe, time);
      break;
    }
    case "trail": {
      trail(field, state, probe, pointer.inside, delta);
      break;
    }
    case "none": {
      break;
    }
    default: {
      const exhaustive: never = interaction;
      return exhaustive;
    }
  }
};

import {
  createToneField,
  fillToneField,
  mapTones,
  resolveCharset,
} from "@/lib/ascii";
import type { AsciiGridDrawContext, MapOptions, ToneField } from "@/lib/ascii";

// The scene every engine page draws, so charsets and colour modes can be
// compared on the same picture: a lit, banded planet with a ring, over a
// faint sky. Tones and colours come from one function of the sample.

const TAU = Math.PI * 2;

/** Hue (turns), saturation and lightness to sRGB bytes. */
const hsl = (
  h: number,
  s: number,
  l: number
): readonly [number, number, number] => {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

/**
 * Tone and colour at (u, v) in [0, 1], v down, for a box `aspect` wide per
 * unit of height, at `time` seconds.
 */
export const planet = (
  u: number,
  v: number,
  aspect: number,
  time: number
): readonly [number, number, number, number] => {
  // Centre-relative coordinates in units of box height.
  const x = (u - 0.5) * aspect;
  const y = v - 0.5;
  const radius = 0.34;
  const spin = time * 0.25;

  // The ring: a thin tilted ellipse, hidden where the planet covers it.
  const rx = x * Math.cos(0.35) + y * Math.sin(0.35);
  const ry = -x * Math.sin(0.35) + y * Math.cos(0.35);
  const ringDistance = Math.hypot(rx / 1.75, ry / 0.42) / radius;
  const onRing = ringDistance > 0.82 && ringDistance < 1.02;
  const behind = ry < 0;

  const d = Math.hypot(x, y) / radius;
  if (d < 1 && !(onRing && !behind)) {
    const z = Math.sqrt(1 - d * d);
    const nx = x / radius;
    const ny = y / radius;
    // Light from the upper left, a touch in front.
    // Some ambient light keeps the night side readable as a disc.
    const light = 0.22 + 0.78 * Math.max(0, nx * -0.55 + ny * -0.5 + z * 0.67);
    const longitude = Math.atan2(nx, z) / TAU + spin;
    const latitude = ny;
    const bands =
      0.5 + 0.5 * Math.sin(latitude * 14 + Math.sin(longitude * TAU * 2) * 0.8);
    const tone = Math.min(1, light * (0.62 + bands * 0.38));
    const [r, g, b] = hsl(
      0.58 + bands * 0.32 + latitude * 0.1,
      0.75,
      0.25 + light * 0.5
    );
    return [tone, r, g, b];
  }
  if (onRing) {
    const shade = 1 - Math.abs(ringDistance - 0.92) * 8;
    const tone = Math.max(0, 0.35 + shade * 0.5);
    const [r, g, b] = hsl(0.09 + ringDistance * 0.05, 0.85, 0.35 + shade * 0.3);
    return [tone, r, g, b];
  }
  // Sky: a faint glow from the lower right and a few fixed stars.
  const glow = Math.max(0, 0.14 - Math.hypot(u - 0.95, v - 1.05) * 0.4);
  const star =
    Math.sin(u * 912.3 + v * 431.7) * Math.cos(u * 211.9 - v * 877.1) > 0.995
      ? 0.85
      : 0;
  const tone = Math.max(glow, star);
  const [r, g, b] = star > 0 ? [240, 240, 255] : hsl(0.72, 0.6, 0.18 + glow);
  return [tone, r, g, b];
};

/**
 * A `draw` function for `AsciiGrid` that maps the planet through
 * `mapTones` with `look`. Keeps one tone field between frames.
 */
export const createPlanetDraw = () => {
  let field: ToneField | null = null;
  let key = "";
  return (context: AsciiGridDrawContext, look: MapOptions = {}) => {
    const { columns, rows, metrics, time, frame } = context;
    const charset = resolveCharset(look.charset, look.chars);
    const nextKey = `${columns}x${rows}:${charset.grid.join("x")}`;
    if (!field || key !== nextKey) {
      field = createToneField(columns, rows, charset, { color: true });
      key = nextKey;
    }
    const aspect = (columns * metrics.width) / (rows * metrics.height);
    fillToneField(field, (u, v) => planet(u, v, aspect, time));
    mapTones(field, columns, rows, look, frame);
  };
};

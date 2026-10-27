"use client";

import type { AsciiColor, ColorMode } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { AsciiShader } from "@/lib/ascii/shader";

// The deep, back to front: a blue gradient, light shafts and caustics from
// the surface, marine snow, rising bubbles, then the jellyfish as glowing
// translucent bells with trailing tentacles. Returns the light as rgb and
// the glyph density as a. Space is `p`: y from -0.5 to 0.5, x scaled by
// the box's aspect ratio.
const SCENE = `
const float ABYSS_TAU = 6.28318530718;

float abyss_rand(float n, float salt) {
  return hash21(vec2(n, salt));
}

vec3 abyss_hue(float i) {
  float k = mod(i, 5.0);
  if (k < 1.0) {
    return vec3(0.35, 0.9, 1.0);
  }
  if (k < 2.0) {
    return vec3(1.0, 0.4, 0.85);
  }
  if (k < 3.0) {
    return vec3(0.62, 0.5, 1.0);
  }
  if (k < 4.0) {
    return vec3(0.45, 1.0, 0.78);
  }
  return vec3(1.0, 0.68, 0.42);
}

// Points that drift through a sliding grid: marine snow sinks, bubbles
// rise. Each cell holds at most one, at a random spot.
float abyss_motes(vec2 p, float cellSize, float fall, float keep, float seed, float t, float px) {
  vec2 s = vec2(p.x + 0.01 * sin(p.y * 9.0 + t * 0.4 + seed), p.y + t * fall);
  vec2 id = floor(s / cellSize);
  vec2 f = s / cellSize - id;
  float h = hash21(id + seed);
  if (h > keep) {
    return 0.0;
  }
  vec2 at = 0.2 + 0.6 * vec2(hash21(id + seed + 1.0), hash21(id + seed + 2.0));
  float d = length((f - at) * cellSize);
  return smoothstep(1.1 * px, 0.2 * px, d) * (0.4 + 0.6 * h / keep);
}

// A bubble column: hollow rings that wobble as they climb.
float abyss_bubbles(vec2 p, float t, float px) {
  float lane = 0.09;
  float id = floor(p.x / lane);
  float h = abyss_rand(id, 31.0);
  if (h > 0.45) {
    return 0.0;
  }
  float speed = 0.06 + 0.06 * abyss_rand(id, 32.0);
  float spacing = 0.12 + 0.1 * abyss_rand(id, 33.0);
  float y = p.y + 0.5 - t * speed;
  float slot = floor(y / spacing);
  float local = y - slot * spacing - spacing * 0.5;
  float size = (0.7 + 0.9 * hash21(vec2(id, slot))) * px * (0.8 + 0.6 * (p.y + 0.5));
  float x = (id + 0.5) * lane + 0.012 * sin(t * 2.0 + slot * 1.7 + id);
  float d = length(vec2(p.x - x, local));
  float ring = smoothstep(0.9 * px, 0.0, abs(d - size)) + smoothstep(size * 0.6, 0.0, length(vec2(p.x - x + size * 0.35, local - size * 0.35))) * 0.6;
  return ring * step(0.5, hash21(vec2(id, slot) + 4.0)) * smoothstep(-0.5, -0.3, p.y);
}

// One jellyfish. Returns (glow, cover): glow is the light it gives off,
// cover how much it hides what is behind it.
vec2 abyss_jelly(vec2 p, float i, float count, float aspect, float halfHeight, float t, vec2 pointer, float present, float px) {
  float r1 = abyss_rand(i, 1.0);
  float r2 = abyss_rand(i, 2.0);
  float r3 = abyss_rand(i, 3.0);
  float size = mix(0.075, 0.13, r1) * abyssSize;
  float rate = mix(0.28, 0.45, r2);

  // One pulse: a quick squeeze (contraction) then a slow relax. The bell
  // only rises while it squeezes, which is what makes them swim in surges.
  float beat = t * rate + r3 * 7.0;
  float cycle = fract(beat);
  float squeeze = smoothstep(0.0, 0.18, cycle) * (1.0 - smoothstep(0.22, 0.95, cycle));
  float travel = floor(beat) + smoothstep(0.02, 0.4, cycle);
  // Spread across the width in lanes, staggered in height, and wrapped
  // top to bottom out of sight.
  float span = 2.0 * halfHeight + 0.5;
  float y = mod(fract(i * 0.618 + 0.2) * span + travel * size * 0.5, span) - halfHeight - 0.22;
  float lane = (i + 0.5) / count - 0.5;
  float x = lane * aspect * 0.86 + (r3 - 0.5) * 0.08 + 0.05 * sin(t * 0.13 + i * 2.1);
  vec2 center = vec2(x, y);
  // The pointer nudges the whole jelly, smaller ones further; a negative
  // abyssPush draws them in instead.
  vec2 away = center - pointer;
  float near = exp(-dot(away, away) * 7.0);
  vec2 push = normalize(away + 0.0001) * near * 0.09 * present * abyssPush * (1.3 - r1 * 0.6);
  center += push;

  vec2 l = p - center;
  float tilt = 0.18 * sin(t * 0.21 + i * 1.9) - push.x * 1.5;
  float cs = cos(tilt);
  float sn = sin(tilt);
  l = vec2(cs * l.x - sn * l.y, sn * l.x + cs * l.y);

  float reach = size * (2.4 + 1.2 * r3);
  if (abs(l.x) > size * 2.2 || l.y > size * 1.3 || l.y < -reach - size) {
    return vec2(0.0);
  }

  float w = size * (1.0 - 0.24 * squeeze);
  float h = size * (0.74 + 0.2 * squeeze);
  float xn = l.x / w;
  // The margin curves down at the sides and is scalloped.
  float margin = -0.16 * h + 0.22 * h * xn * xn + 0.03 * size * cos(xn * 22.0);
  float e = length(vec2(xn, max(l.y, 0.0) / h));
  float inside = smoothstep(1.0 + px / w, 1.0 - px / w, e) * smoothstep(margin - px, margin + px, l.y);
  float rim = inside * smoothstep(0.72, 0.98, e) + inside * smoothstep(margin + 3.0 * px, margin, l.y);
  float angle = atan(xn, l.y / h);
  float canals = pow(0.5 + 0.5 * cos(angle * 8.0), 8.0) * inside * 0.35;
  float gonads = exp(-pow((e - 0.42) * 14.0, 2.0)) * pow(0.5 + 0.5 * cos(angle * 4.0), 3.0) * inside;
  float halo = exp(-max(e - 1.0, 0.0) * 5.0) * 0.18 * (1.0 - inside) * step(margin - 0.02, l.y);
  float glow = inside * 0.05 + rim * 0.9 + gonads * 0.35 + canals * 0.5 + halo;
  glow *= 0.85 + 0.3 * squeeze;

  // Tentacles hang from the margin. Each bends on a travelling wave that
  // grows toward the tip, and squeezing draws them in, like the bell's
  // own stroke dragging them through the water.
  float below = 0.0;
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    float anchor = (-0.82 + 1.64 * fk / 7.0) * w;
    float an = anchor / w;
    float top = -0.16 * h + 0.22 * h * an * an;
    float len = reach * (0.75 + 0.35 * abyss_rand(i * 9.0 + fk, 4.0));
    float s = (top - l.y) / len;
    if (s < 0.0 || s > 1.0) {
      continue;
    }
    float sway = sin(s * 6.0 - t * 1.9 + fk * 1.3 + i) * s * size * 0.32;
    float lag = sin(t * 0.7 + i + s * 2.0) * s * s * size * 0.25;
    float tx = anchor * (1.0 - 0.35 * squeeze * s) + sway + lag;
    float d = abs(l.x - tx);
    float beads = 0.75 + 0.25 * sin(s * 50.0 - t * 5.0 + fk);
    below += smoothstep(1.15 * px, 0.15 * px, d) * pow(1.0 - s, 1.1) * beads * smoothstep(0.0, 0.12, s);
  }
  // Two frilled oral arms down the middle, shorter and thicker.
  for (int k = 0; k < 2; k++) {
    float side = float(k) * 2.0 - 1.0;
    float len = reach * 0.55;
    float s = (-0.1 * h - l.y) / len;
    if (s < 0.0 || s > 1.0) {
      continue;
    }
    float tx = side * w * 0.14 + sin(s * 7.0 - t * 1.3 + side) * size * 0.12 * (0.3 + s);
    float width = px * (0.6 + 1.2 * (1.0 - s)) * (0.75 + 0.5 * snoise(vec2(s * 14.0, t + side)));
    float d = abs(l.x - tx);
    below += smoothstep(width + px, width - px, d) * (1.0 - s) * 0.5 * smoothstep(0.0, 0.1, s);
  }
  glow += below * abyssTentacles;
  return vec2(glow, inside * 0.7);
}

vec4 abyssScene(vec2 uv, vec2 res, float t) {
  // Narrow boxes (a phone held upright) zoom out so the jellies keep
  // their size relative to each other and still fit side by side.
  float zoom = clamp(res.x / res.y / 1.1, 0.55, 1.0);
  float aspect = res.x / res.y / zoom;
  float px = 1.0 / res.y / zoom;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0 / zoom);
  vec2 pointer = (u_pointer.xy - 0.5) * vec2(aspect, 1.0 / zoom);
  float present = u_pointer.z * abyssInteract;

  // Water: lit teal near the surface, close to black in the deep.
  float depth = 0.5 / zoom - p.y;
  vec3 rgb = mix(vec3(0.03, 0.22, 0.32), vec3(0.0, 0.015, 0.05), smoothstep(0.0, 0.85, depth));
  float tone = mix(0.26, 0.02, smoothstep(0.0, 1.0, depth));
  // A little per-sample noise dissolves the line where the gradient drops
  // below the faintest glyph, instead of leaving a hard edge.
  tone += (hash21(uv * res + 0.5) - 0.5) * 0.12;

  // Shafts of light slanting down from the surface, swaying slowly.
  float slant = p.x + p.y * 0.42;
  float shaft = fbm(vec2(slant * 6.0, t * 0.05)) * 0.6 + fbm(vec2(slant * 14.0 + 3.0, t * 0.09)) * 0.4;
  shaft = smoothstep(0.55, 0.8, shaft) * smoothstep(0.85, 0.05, depth) * abyssRays;
  rgb += vec3(0.2, 0.55, 0.62) * shaft * 0.6;
  tone += shaft * 0.38;

  // Caustics: a bright net rippling just under the surface.
  vec2 cq = vec2(p.x * 7.0, p.y * 12.0);
  float warpN = snoise(cq * 0.5 + t * 0.25);
  float net = 1.0 - abs(snoise(cq + vec2(warpN, t * 0.35)));
  float caustic = pow(net, 8.0) * smoothstep(0.12, 0.0, depth) * abyssRays;
  rgb += vec3(0.5, 0.85, 0.9) * caustic;
  tone += caustic * 0.45;

  // Marine snow in two depths, and bubble columns.
  float snow = abyss_motes(p, 0.05, 0.012, 0.22, 3.0, t, px) * 0.55 + abyss_motes(p, 0.03, 0.007, 0.16, 7.0, t, px) * 0.35;
  snow *= abyssSnow;
  rgb += vec3(0.6, 0.75, 0.8) * snow;
  tone = max(tone, snow * 0.8);
  float bubbles = abyss_bubbles(p, t, px) * abyssBubbles;
  rgb += vec3(0.6, 0.9, 1.0) * bubbles * 0.8;
  tone = max(tone, bubbles * 0.85);

  // The jellies, each nudged away from the pointer.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    if (fi >= abyssCount) {
      break;
    }
    vec2 jelly = abyss_jelly(p, fi, abyssCount, aspect, 0.5 / zoom, t, pointer, present, px);
    vec3 hue = abyss_hue(fi + floor(abyssHue));
    rgb = mix(rgb, rgb * 0.4, jelly.y);
    tone = mix(tone, tone * 0.4, jelly.y);
    rgb += hue * jelly.x * 1.25 + vec3(0.9, 0.95, 1.0) * max(jelly.x - 0.8, 0.0);
    tone += jelly.x * 0.95;
  }

  // Tones above are perceived brightness; the engine reads tone as ink
  // coverage, which grows closer to linear light.
  return vec4(rgb, pow(clamp(tone, 0.0, 1.0), 1.8));
}

// field() runs first and colorField() right after it at the same uv, so
// keep the last result instead of painting the whole scene twice.
vec4 abyss_last = vec4(0.0);
vec2 abyss_lastUv = vec2(-1.0);

vec4 abyss_paint(vec2 uv, vec2 res, float t) {
  if (uv != abyss_lastUv) {
    abyss_last = abyssScene(uv, res, t);
    abyss_lastUv = uv;
  }
  return abyss_last;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return abyss_paint(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 rgb = abyss_paint(uv, res, t).rgb;
  float peak = max(rgb.r, max(rgb.g, rgb.b));
  return rgb / max(peak, 0.0001) * mix(0.45, 1.0, sqrt(clamp(peak, 0.0, 1.0)));
}
`;

// Colour modes that paint their own colours need a night behind them in
// both themes; mono and palette keep the theme's (or phosphor's) paper.
const NIGHT = "#010409";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

export interface AbyssalJellyfishSceneProps extends AsciiSceneProps {
  /** How many jellyfish, from 1 to 7. Default 5. */
  jellies?: number;
  /** Jellyfish size, from 0.5 to 1.6. Default 1. */
  size?: number;
  /** Tentacle brightness, from 0 to 1.5. Default 1. */
  tentacles?: number;
  /** Shifts which colour each jellyfish gets, from 0 to 4. Default 0. */
  hue?: number;
  /** Light shafts and caustics from the surface, from 0 to 1.5. Default 1. */
  rays?: number;
  /** Bubble columns, from 0 to 1.5. Default 1. */
  bubbles?: number;
  /** Marine snow, from 0 to 2. Default 1. */
  snow?: number;
  /** How the pointer moves the jellies: positive pushes them away, negative draws them in. From -1 to 1. Default 1. */
  push?: number;
  /**
   * Paper behind the glyphs. Default: a deep night colour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
}

/** Bioluminescent Abyss Aquarium. Jellyfish drifting with sine-driven tentacles, rising bubbles and caustic light rays in the deep. */
export const AbyssalJellyfishScene = ({
  jellies = 5,
  size = 1,
  tentacles = 1,
  hue = 0,
  rays = 1,
  bubbles = 1,
  snow = 1,
  push = 1,
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 6,
  interactive = true,
  ...props
}: AbyssalJellyfishSceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      fps={fps}
      stillTime={stillTime}
      uniforms={{
        abyssBubbles: bubbles,
        abyssCount: jellies,
        abyssHue: hue,
        abyssInteract: interactive ? 1 : 0,
        abyssPush: push,
        abyssRays: rays,
        abyssSize: size,
        abyssSnow: snow,
        abyssTentacles: tentacles,
      }}
      {...props}
    />
  );
};

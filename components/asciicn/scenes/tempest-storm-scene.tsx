"use client";

import type { AsciiColor, ColorMode } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { AsciiShader } from "@/lib/ascii/shader";

// A storm in one pass: a dark sky, two decks of cloud shaded by a light
// above them, lightning bolts traced as distance fields, slanted rain and
// the hills on the horizon. Returns the light as rgb and the glyph density
// as a. Space is `p`: y from -0.5 to 0.5, x scaled by the aspect ratio.
const SCENE = `
// Linear value noise in 1D. Summing octaves at doubling frequency and
// halving amplitude is midpoint displacement: each octave bends the
// midpoints of the segments the octave before it drew.
float tempest_wiggle(float s, float seed) {
  float i = floor(s);
  float f = s - i;
  return mix(hash21(vec2(i, seed)), hash21(vec2(i + 1.0, seed)), f) * 2.0 - 1.0;
}

float tempest_path(float s, float seed) {
  float sum = 0.0;
  float amp = 0.55;
  float freq = 2.0;
  for (int o = 0; o < 5; o++) {
    sum += amp * tempest_wiggle(s * freq, seed + float(o) * 13.1);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

// Distance from p to a jagged bolt from a to b, and how far along it the
// nearest point is (0 at a, 1 at b), in along. Both ends stay pinned.
float tempest_bolt(vec2 p, vec2 a, vec2 b, float spread, float seed, out float along) {
  along = 0.0;
  vec2 dir = b - a;
  float span = length(dir);
  // Most of the screen is nowhere near a bolt: skip the walk there.
  vec2 pa = p - a;
  float h = clamp(dot(pa, dir) / dot(dir, dir), 0.0, 1.0);
  if (length(pa - dir * h) > spread * span * 0.8 + 0.06) {
    return 1000.0;
  }
  vec2 n = vec2(-dir.y, dir.x) / span;
  float p0 = tempest_path(0.0, seed);
  float p1 = tempest_path(1.0, seed);
  float best = 1000.0;
  vec2 prev = a;
  for (int i = 1; i <= 32; i++) {
    float s = float(i) / 32.0;
    vec2 cur = mix(a, b, s) + n * span * spread * (tempest_path(s, seed) - mix(p0, p1, s));
    vec2 sa = p - prev;
    vec2 seg = cur - prev;
    float k = clamp(dot(sa, seg) / dot(seg, seg), 0.0, 1.0);
    float d = length(sa - seg * k);
    if (d < best) {
      best = d;
      along = (float(i) - 1.0 + k) / 32.0;
    }
    prev = cur;
  }
  return best;
}

// Point s of the same bolt, so branches can start on it.
vec2 tempest_boltPoint(vec2 a, vec2 b, float spread, float seed, float s) {
  vec2 dir = b - a;
  float span = length(dir);
  vec2 n = vec2(-dir.y, dir.x) / span;
  float off = tempest_path(s, seed) - mix(tempest_path(0.0, seed), tempest_path(1.0, seed), s);
  return mix(a, b, s) + n * span * spread * off;
}

// A whole strike: the main channel plus three forks that leave it and
// fade out. Returns (core, halo) light.
vec2 tempest_strike(vec2 p, vec2 a, vec2 b, float seed, float px) {
  float along;
  float d = tempest_bolt(p, a, b, 0.26, seed, along);
  float core = smoothstep(1.4 * px, 0.3 * px, d);
  float halo = exp(-d * 38.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float s = 0.18 + 0.22 * fk + 0.08 * hash21(vec2(seed, fk));
    vec2 from = tempest_boltPoint(a, b, 0.26, seed, s);
    float side = hash21(vec2(seed, fk + 5.0)) > 0.5 ? 1.0 : -1.0;
    float len = length(b - a) * (0.22 + 0.2 * hash21(vec2(seed, fk + 9.0)));
    vec2 to = from + vec2(side * len * 0.75, -len * 0.8);
    float bAlong;
    float bd = tempest_bolt(p, from, to, 0.3, seed + fk * 3.7 + 1.0, bAlong);
    float fade = 1.0 - bAlong;
    core = max(core, smoothstep(1.1 * px, 0.2 * px, bd) * fade * 0.85);
    halo = max(halo, exp(-bd * 50.0) * fade * 0.6);
  }
  return vec2(core, halo);
}

// How bright a strike is tau seconds after it lands: a first stroke, then
// two return strokes down the same channel, as real bolts flicker.
float tempest_flicker(float tau) {
  if (tau < 0.0) {
    return 0.0;
  }
  float e = exp(-tau * 9.0);
  e += 0.85 * step(0.11, tau) * exp(-(tau - 0.11) * 10.0);
  e += 0.55 * step(0.27, tau) * exp(-(tau - 0.27) * 9.0);
  return min(e, 1.0);
}

float tempest_cloud(vec2 q, float t) {
  // Billows: folded noise rounds the tops of the cells like cauliflower.
  float d = fbm(q * vec2(1.1, 1.7) + vec2(t * 0.03, 0.0));
  d += 0.45 * (1.0 - abs(snoise(q * vec2(3.6, 4.6) + vec2(t * 0.06, -t * 0.02)))) - 0.28;
  // A ragged cloud base, then thicker toward the top.
  float base = smoothstep(-0.14, 0.12, q.y + 0.06 * snoise(vec2(q.x * 3.0, t * 0.05)));
  return clamp((d - 0.36) * 2.4, 0.0, 1.0) * base;
}

vec4 tempestScene(vec2 uv, vec2 res, float t) {
  // Narrow boxes (a phone held upright) zoom out so the whole composition
  // still fits, with the ground kept on the bottom edge.
  float zoom = clamp(res.x / res.y / 1.1, 0.55, 1.0);
  float aspect = res.x / res.y / zoom;
  float px = 1.0 / res.y / zoom;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0 / zoom) + vec2(0.0, 0.5 / zoom - 0.5);
  vec2 pointer = (u_pointer.xy - 0.5) * vec2(aspect, 1.0 / zoom) + vec2(0.0, 0.5 / zoom - 0.5);
  float present = u_pointer.z * tempestInteract;
  float groundY = -0.36;

  // The timed strikes: one chance per epoch, at a random spot.
  float period = 3.4 / max(tempestStrikes, 0.05);
  float epoch = floor(t / period);
  float tau = t - epoch * period - 0.3 * hash21(vec2(epoch, 2.0));
  float chance = step(0.25, hash21(vec2(epoch, 1.0)));
  float flash = tempest_flicker(tau) * chance;
  float x = (hash21(vec2(epoch, 3.0)) - 0.5) * aspect * 0.8;
  vec2 a = vec2(x + 0.08 * (hash21(vec2(epoch, 4.0)) - 0.5), 0.22);
  vec2 b = vec2(x + 0.25 * (hash21(vec2(epoch, 5.0)) - 0.5), groundY);

  // A press calls a bolt down onto the pointer.
  float age = u_click.z;
  vec2 hit = (u_click.xy - 0.5) * vec2(aspect, 1.0 / zoom) + vec2(0.0, 0.5 / zoom - 0.5);
  hit.y = min(hit.y, 0.08);
  float clickFlash = tempest_flicker(age) * tempestInteract;
  vec2 ca = vec2(hit.x + 0.06 * sin(hit.x * 40.0), 0.26);
  float clickSeed = floor(u_click.x * 97.0) + floor(u_click.y * 89.0) * 3.0;

  float sky = max(flash, clickFlash);
  vec2 lightAt = flash >= clickFlash ? a : ca;

  // Sky: almost black, a touch lighter at the horizon.
  vec3 rgb = mix(vec3(0.04, 0.05, 0.09), vec3(0.01, 0.012, 0.03), smoothstep(-0.4, 0.5, p.y));
  float tone = 0.06 + 0.14 * smoothstep(0.1, -0.36, p.y);
  tone += (hash21(uv * res + 0.5) - 0.5) * 0.08;

  // Far cloud deck, dim, slow and only lightly shaded.
  vec2 qf = p * 0.8 + vec2(4.0, 0.05) - pointer * 0.01 * present;
  float far = tempest_cloud(qf, t * 0.6);
  rgb = mix(rgb, vec3(0.12, 0.13, 0.2), far * 0.8);
  tone = mix(tone, 0.22, far * 0.8);

  // Near deck. Shading compares the density here with the density a
  // little toward the light above: where it thins toward the light, the
  // cloud is lit; where more cloud stands in the way, it is in shadow.
  vec2 qn = p - pointer * 0.025 * present;
  float dens = tempest_cloud(qn, t);
  float toward = tempest_cloud(qn + vec2(-0.03, 0.08), t);
  float lit = clamp(0.55 + (dens - toward) * 2.2, 0.0, 1.0);
  float inner = exp(-length((p - lightAt) * vec2(0.8, 1.4)) * 3.5) * sky;
  vec3 cloud = mix(vec3(0.06, 0.07, 0.12), vec3(0.5, 0.55, 0.72), lit * lit);
  cloud += vec3(0.7, 0.6, 1.0) * inner * (0.4 + 0.8 * dens);
  float cloudTone = 0.14 + 0.62 * lit * lit * dens + 0.6 * inner * dens;
  rgb = mix(rgb, cloud, dens);
  tone = mix(tone, cloudTone, smoothstep(0.0, 0.35, dens));

  // The whole sky lifts in the flash.
  rgb += vec3(0.25, 0.22, 0.4) * sky * tempestFlash * (0.3 + 0.7 * dens);
  tone += 0.22 * sky * tempestFlash;

  // Bolts: white cores with a violet bloom around them.
  // The channel stays at full brightness while it flickers; only the
  // bloom around it follows the flicker.
  vec2 bolt = vec2(0.0);
  if (flash > 0.02) {
    bolt = tempest_strike(p, a, b, epoch * 7.31, px) * vec2(smoothstep(0.02, 0.2, flash), flash);
  }
  if (clickFlash > 0.02) {
    bolt = max(bolt, tempest_strike(p, ca, hit, clickSeed, px) * vec2(smoothstep(0.02, 0.2, clickFlash), clickFlash));
  }
  rgb += vec3(0.6, 0.5, 1.0) * bolt.y * 0.8 + vec3(0.92, 0.95, 1.0) * bolt.x;
  tone = max(tone, max(bolt.x, bolt.y * 0.75));

  // Rain in three sheets, far to near, slanted by the wind. The pointer
  // leans the wind.
  float wind = tempestWind * 0.32 + (pointer.x * 0.25) * present;
  float rain = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float lane = 0.008 + 0.004 * fk;
    float speed = 1.2 + 0.5 * fk;
    vec2 r = vec2(p.x + p.y * wind, p.y);
    float col = floor(r.x / lane);
    float fx = r.x / lane - col;
    float hk = hash21(vec2(col, fk + 40.0));
    float spacing = 0.22 + 0.25 * hash21(vec2(col, fk + 41.0));
    float y = (r.y + t * speed) / spacing + hk * 9.0;
    float drop = fract(y);
    float streak = 0.1 + 0.06 * fk;
    float body = smoothstep(0.0, 0.03, drop) * smoothstep(streak, streak * 0.4, drop);
    float thin = smoothstep(0.5, 0.15, abs(fx - 0.5));
    rain = max(rain, body * thin * step(hk, 0.5 * tempestRain) * (0.34 + 0.1 * fk));
  }
  rain *= 1.0 + 0.6 * sky;
  rgb += vec3(0.55, 0.65, 0.85) * rain;
  tone = max(tone, rain);

  // Hills on the horizon, black until a flash outlines them.
  float hills = groundY + 0.035 * snoise(vec2(p.x * 2.2, 3.0)) + 0.012 * snoise(vec2(p.x * 9.0, 1.0));
  float ground = smoothstep(hills + px, hills - px, p.y);
  float edge = ground * smoothstep(hills - 3.0 * px, hills, p.y);
  rgb = mix(rgb, vec3(0.01, 0.01, 0.02) + vec3(0.6, 0.6, 0.9) * edge * sky, ground);
  tone = mix(tone, 0.02 + 0.8 * edge * sky, ground);

  // Tones above are perceived brightness; the engine reads tone as ink
  // coverage, which grows closer to linear light.
  return vec4(rgb, pow(clamp(tone, 0.0, 1.0), 1.8));
}

// field() runs first and colorField() right after it at the same uv, so
// keep the last result instead of painting the whole scene twice.
vec4 tempest_last = vec4(0.0);
vec2 tempest_lastUv = vec2(-1.0);

vec4 tempest_paint(vec2 uv, vec2 res, float t) {
  if (uv != tempest_lastUv) {
    tempest_last = tempestScene(uv, res, t);
    tempest_lastUv = uv;
  }
  return tempest_last;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return tempest_paint(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 rgb = tempest_paint(uv, res, t).rgb;
  float peak = max(rgb.r, max(rgb.g, rgb.b));
  return rgb / max(peak, 0.0001) * mix(0.45, 1.0, sqrt(clamp(peak, 0.0, 1.0)));
}
`;

// Colour modes that paint their own colours need a night behind them in
// both themes; mono and palette keep the theme's (or phosphor's) paper.
const NIGHT = "#03040a";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

export interface TempestStormSceneProps extends AsciiSceneProps {
  /** How often lightning strikes on its own, from 0 to 3. 0 leaves only the strikes you call with a press. Default 1. */
  strikes?: number;
  /** How much a strike lights the sky, from 0 to 1.5. Default 1. */
  flash?: number;
  /** Rain density, from 0 to 2. Default 1. */
  rain?: number;
  /** How far the wind slants the rain, from -2 to 2. Default 1. */
  wind?: number;
  /**
   * Paper behind the glyphs. Default: a deep night colour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
}

/** Procedural Lightning & Cumulonimbus. Volumetric storm clouds split by branching fractal lightning, with screen-flash bloom and wind-driven rain. */
export const TempestStormScene = ({
  strikes = 1,
  flash = 1,
  rain = 1,
  wind = 1,
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 7.1,
  interactive = true,
  ...props
}: TempestStormSceneProps) => {
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
        tempestFlash: flash,
        tempestInteract: interactive ? 1 : 0,
        tempestRain: rain,
        tempestStrikes: strikes,
        tempestWind: wind,
      }}
      {...props}
    />
  );
};

"use client";

import type { AsciiColor, ColorMode } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { AsciiShader } from "@/lib/ascii/shader";

// One GLSL pass paints the whole night: sky, moon and stars, three rows of
// pines, the fire with its sparks and smoke, and the fireflies. It returns
// the light as rgb and the glyph density as a, so `field` and `colorField`
// read the same picture. Space is `p`: y from -0.5 (bottom) to 0.5, x
// scaled by the box's aspect ratio, so shapes never stretch.
const SCENE = `
float campfire_rand(float n, float salt) {
  return hash21(vec2(n, salt));
}

// A pine as a horizontal distance: negative inside. q is measured from
// the foot of the trunk, h is the height and w the half-width of the
// lowest tier. Tiers flare out at their lower edges like real branches.
float campfire_pine(vec2 q, float h, float w) {
  float y = q.y / h;
  float trunk = max(abs(q.x) - w * 0.07, max(-q.y, q.y - h * 0.2));
  float yy = (y - 0.1) / 0.9;
  float tier = fract(yy * 5.0 + 0.15);
  float width = w * (1.0 - yy) * (0.42 + 0.58 * (1.0 - tier) * (1.0 - tier));
  float crown = abs(q.x) - width;
  crown = max(crown, max(-yy, yy - 1.0) * h);
  return min(trunk, crown);
}

// One row of pines. Returns (cover, warm rim, cool rim): cover is 1 inside
// a tree, and the rims light the edge facing the fire and the edge facing
// the moon. clear keeps trees out of a gap around x = 0.
vec3 campfire_row(vec2 p, float spacing, float base, vec2 size, float seed, float clear, vec2 fire, float px) {
  float cover = 0.0;
  float warm = 0.0;
  float cool = 0.0;
  float cellId = floor(p.x / spacing);
  for (int k = -1; k <= 1; k++) {
    float id = cellId + float(k);
    float r1 = campfire_rand(id, seed);
    float r2 = campfire_rand(id, seed + 3.7);
    float cx = (id + 0.15 + 0.7 * r1) * spacing;
    if (r2 < 0.1 || abs(cx - fire.x) < clear) {
      continue;
    }
    float h = mix(size.x, size.y, r2);
    float foot = base + 0.025 * sin(cx * 3.1 + seed);
    vec2 q = vec2(p.x - cx, p.y - foot);
    float d = campfire_pine(q, h, h * 0.34);
    float inside = smoothstep(px, -px, d);
    // The rim is the band just inside the outline.
    float rim = inside * smoothstep(-3.0 * px, -0.4 * px, d);
    float towardFire = step(0.0, q.x * sign(fire.x - cx + 0.0001));
    float nearFire = 1.0 / (1.0 + 18.0 * dot(p - fire, p - fire));
    warm = max(warm, rim * towardFire * nearFire);
    cool = max(cool, rim * step(0.0, q.x) * smoothstep(0.0, h, q.y));
    cover = max(cover, inside);
  }
  return vec3(cover, warm, cool);
}

// Flame heat at q, measured from the base of the fire. Two noise layers
// scroll upward at different rates; the slower one bends the faster one,
// which is what splits the body into licking tongues.
float campfire_flame(vec2 q, float t, float lean, float size) {
  float height = 0.36 * size;
  float y = q.y / height;
  if (y < -0.3 || y > 1.7) {
    return 0.0;
  }
  q.x -= lean * y * y * height * 0.55;
  vec2 n = vec2(q.x / height * 2.6, y * 1.6);
  float slow = fbm(n * 0.8 + vec2(0.0, -t * 0.9));
  float bend = fbm(n * 1.3 + vec2(4.2, -t * 1.7)) - 0.5;
  float tongues = fbm(vec2(n.x * 2.2 + bend * 2.4, n.y * 2.0 - t * 3.1));
  float width = 0.48 * height * pow(max(1.0 - y * 0.72, 0.0), 0.85) * (0.8 + 0.5 * slow);
  float body = 1.0 - abs(q.x + bend * 0.05 * size) / max(width, 0.0001);
  float heat = body * 1.15 - y * 0.62 + (tongues - 0.5) * (0.7 + 1.1 * y);
  heat *= smoothstep(-0.3, 0.08, y);
  return clamp(heat, 0.0, 1.4);
}

vec3 campfire_heatColor(float h) {
  vec3 c = mix(vec3(0.4, 0.03, 0.02), vec3(0.98, 0.3, 0.04), smoothstep(0.0, 0.4, h));
  c = mix(c, vec3(1.0, 0.66, 0.16), smoothstep(0.35, 0.75, h));
  return mix(c, vec3(1.0, 0.95, 0.72), smoothstep(0.78, 1.15, h));
}

// Sparks live in a grid that rises with them, so each keeps its cell (and
// its random seed) for its whole flight. Each dies at its own height.
float campfire_sparks(vec2 q, float t, float lean, float cellSize, float seed, float px) {
  float rise = 0.11 + 0.03 * seed;
  vec2 s = vec2(q.x - lean * q.y * 0.45, q.y - t * rise);
  vec2 id = floor(s / cellSize);
  vec2 f = s / cellSize - id;
  float r = hash21(id + seed * 17.0);
  if (r < 0.55) {
    return 0.0;
  }
  float life = mix(0.18, 0.62, hash21(id + seed * 5.0 + 2.0));
  float drift = sin(t * (1.5 + 2.0 * r) + r * 40.0) * 0.28;
  vec2 at = vec2(0.5 + drift, 0.5) + (vec2(hash21(id + 0.3), hash21(id + 0.7)) - 0.5) * 0.4;
  vec2 d = (f - at) * cellSize;
  // A short vertical streak: the spark smeared by its own motion.
  float dist = length(vec2(d.x, d.y * 0.45));
  float dot1 = smoothstep(1.1 * px, 0.2 * px, dist);
  float cone = smoothstep(0.05 + q.y * 0.45, 0.0, abs(q.x - lean * q.y * 0.45));
  float alive = smoothstep(life, life * 0.6, q.y) * smoothstep(0.02, 0.08, q.y);
  float flicker = 0.6 + 0.4 * sin(t * 13.0 + r * 70.0);
  return dot1 * cone * alive * flicker;
}

vec4 campfireScene(vec2 uv, vec2 res, float t) {
  // Narrow boxes (a phone held upright) zoom out so the whole composition
  // still fits, with the ground kept on the bottom edge.
  float zoom = clamp(res.x / res.y / 1.1, 0.55, 1.0);
  float aspect = res.x / res.y / zoom;
  float px = 1.0 / res.y / zoom;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0 / zoom) + vec2(0.0, 0.5 / zoom - 0.5);
  vec2 look = (u_pointer.xy - 0.5) * vec2(aspect, 1.0 / zoom) * u_pointer.z * campInteract;
  float flicker = 0.85 + 0.1 * sin(t * 7.3) + 0.05 * sin(t * 17.1 + 1.3);

  // Breeze: the flames lean away from the pointer, and sway on their own.
  float lean = 0.22 * sin(t * 0.7) + 0.1 * sin(t * 1.9 + 1.0);
  lean += campBreeze * clamp(-look.x * 2.2, -1.2, 1.2) * u_pointer.z * campInteract;

  vec2 fireBase = vec2(0.0, -0.32) - look * 0.07;

  // Sky: indigo at the top, a warm haze over the fire at the horizon.
  vec2 ps = p - look * 0.012;
  float horizon = smoothstep(0.5, -0.25, ps.y);
  vec3 rgb = mix(vec3(0.02, 0.03, 0.08), vec3(0.07, 0.1, 0.2), horizon);
  float airGlow = exp(-length((ps - fireBase) * vec2(0.7, 1.3)) * 3.2) * flicker;
  rgb += vec3(0.28, 0.1, 0.03) * airGlow;
  // A faint band of the Milky Way gives the sky texture, so the pines
  // read as clean silhouettes cut out of it.
  vec2 band = vec2(ps.x * 0.8 + ps.y * 0.6, ps.y - ps.x * 0.5);
  float milk = fbm(band * 5.0 + 3.0) * exp(-band.y * band.y * 18.0);
  rgb += vec3(0.12, 0.13, 0.22) * milk;
  float tone = 0.26 + 0.2 * horizon * horizon + 0.25 * milk * (0.6 + 0.4 * fbm(ps * 22.0));

  // Moon with a soft halo; stars hide in its glare.
  vec2 moonAt = vec2(aspect * 0.3, 1.0 / zoom - 0.7);
  float moonD = length(ps - moonAt);
  float moonDisc = smoothstep(0.052 + px, 0.052 - px, moonD);
  float craters = fbm((ps - moonAt) * 34.0);
  float halo = exp(-moonD * 9.0);
  rgb += vec3(0.5, 0.6, 0.85) * halo * 0.35;
  tone += halo * 0.22;

  vec2 sg = ps * 34.0;
  vec2 sid = floor(sg);
  float sr = hash21(sid + 11.0);
  vec2 sf = fract(sg) - 0.5 - (vec2(hash21(sid + 2.0), hash21(sid + 5.0)) - 0.5) * 0.6;
  float twinkle = 0.55 + 0.45 * sin(t * (1.0 + 3.0 * sr) + sr * 30.0);
  float star = step(1.0 - 0.32 * campStars, sr) * smoothstep(0.09 + 0.2 * sr, 0.0, length(sf)) * twinkle;
  star *= smoothstep(-0.12, 0.15, ps.y) * (1.0 - halo);
  rgb += vec3(0.85, 0.9, 1.0) * star;
  tone += star * 0.85;

  tone += airGlow * 0.18;
  rgb = mix(rgb, vec3(0.86, 0.88, 0.8) * (0.75 + 0.25 * craters), moonDisc);
  tone = mix(tone, 0.7 + 0.3 * craters, moonDisc);

  // Far ridge of small pines, blue in the moonlight haze.
  vec2 pf = p - look * 0.025;
  vec3 far = campfire_row(pf, 0.05, -0.1, vec2(0.07, 0.15), 1.0, 0.0, fireBase, px);
  float ridge = smoothstep(px, -px, pf.y + 0.1 - 0.03 * snoise(vec2(pf.x * 2.0, 1.0)));
  far.x = max(far.x, ridge);
  vec3 farFill = vec3(0.05, 0.08, 0.16);
  rgb = mix(rgb, farFill + vec3(0.25, 0.32, 0.5) * far.z * 0.6, far.x);
  tone = mix(tone, 0.13 + 0.3 * far.z, far.x);

  // Ground: a slope of packed earth, lit warm around the fire.
  float groundLine = -0.3 + 0.02 * sin(p.x * 4.0) + 0.012 * snoise(vec2(p.x * 9.0, 2.0));
  float ground = smoothstep(groundLine + px, groundLine - px, p.y - look.y * 0.05);
  vec2 gd = (p - fireBase) * vec2(0.9, 2.4);
  float pool = exp(-dot(gd, gd) * 16.0) * flicker;
  float grain = fbm(p * vec2(40.0, 70.0));
  vec3 earth = vec3(0.03, 0.025, 0.03) + vec3(0.9, 0.38, 0.1) * pool * (0.6 + 0.4 * grain);
  rgb = mix(rgb, earth, ground);
  tone = mix(tone, 0.1 + 0.1 * grain + 0.8 * pool * (0.5 + 0.5 * grain), ground);

  // Middle row of pines, cleared around the fire.
  vec2 pm = p - look * 0.055;
  vec3 mid = campfire_row(pm, 0.17, -0.31, vec2(0.36, 0.58), 4.0, 0.2, fireBase, px);
  vec3 midRim = vec3(1.0, 0.45, 0.12) * mid.y * 1.4 * flicker + vec3(0.45, 0.55, 0.85) * mid.z * 0.45;
  rgb = mix(rgb, vec3(0.012, 0.014, 0.02) + midRim, mid.x);
  tone = mix(tone, clamp(mid.y * 1.1 * flicker + mid.z * 0.4, 0.0, 1.0), mid.x);

  // Smoke: grey curls that widen and thin as they climb.
  vec2 sq = p - fireBase - vec2(lean * 0.06, 0.0);
  float sy = sq.y - 0.2;
  if (sy > 0.0) {
    float spread = 0.06 + sy * 0.35;
    float curl = fbm(vec2(sq.x * 5.0, sy * 3.0 - t * 0.55)) - 0.5;
    float puff = fbm(vec2((sq.x + curl * 0.12 - sy * lean * 0.3) * 7.0, sy * 4.0 - t * 0.8));
    float smoke = smoothstep(spread, 0.0, abs(sq.x + curl * 0.1 - sy * lean * 0.25));
    smoke *= smoothstep(0.0, 0.08, sy) * smoothstep(0.75, 0.15, sy) * smoothstep(0.35, 0.75, puff);
    smoke *= campSmoke;
    rgb = mix(rgb, mix(vec3(0.5, 0.32, 0.22), vec3(0.32, 0.34, 0.4), smoothstep(0.0, 0.3, sy)), smoke * 0.55);
    tone = mix(tone, 0.32, smoke * 0.75);
  }

  // Logs and the bed of embers under the flames.
  vec2 lq = p - fireBase;
  float log1 = length(vec2(lq.x * 0.9 - lq.y * 1.8, lq.y + 0.008) * vec2(1.0, 5.0)) - 0.07;
  float log2 = length(vec2(lq.x * 0.9 + lq.y * 1.8, lq.y + 0.008) * vec2(1.0, 5.0)) - 0.07;
  float logs = smoothstep(px, -px, min(log1, log2));
  float embers = smoothstep(0.42, 0.75, fbm(lq * 60.0 + vec2(0.0, t * 0.6))) * smoothstep(0.1, 0.0, length(lq * vec2(1.0, 2.5)));
  rgb = mix(rgb, vec3(0.12, 0.05, 0.03) + vec3(1.0, 0.35, 0.05) * embers * flicker, logs);
  tone = mix(tone, 0.2 + 0.7 * embers, logs);

  // The flames.
  float heat = campfire_flame(p - fireBase - vec2(0.0, 0.005), t, lean, campFlame) * flicker;
  float flame = smoothstep(0.02, 0.2, heat);
  rgb = mix(rgb, campfire_heatColor(heat) * (0.6 + 0.6 * heat), flame);
  tone = mix(tone, clamp(0.35 + heat * 0.9, 0.0, 1.0), flame);

  // Sparks in two sizes.
  vec2 fq = p - fireBase;
  float sparks = campfire_sparks(fq, t, lean, 0.045, 1.0, px) + campfire_sparks(fq, t * 1.15, lean, 0.03, 2.0, px) * 0.8;
  sparks *= campSparks;
  rgb += vec3(1.0, 0.6, 0.15) * sparks;
  tone = max(tone, sparks);

  // Fireflies wander on slow Lissajous paths and glow in short pulses.
  vec2 pb = p - look * 0.06;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= campFireflies) {
      break;
    }
    float a = campfire_rand(fi, 21.0);
    float b = campfire_rand(fi, 22.0);
    vec2 at = vec2((a - 0.5) * aspect * 0.92, -0.27 + b * 0.36);
    at += vec2(0.11 * sin(t * 0.21 + fi * 1.7) + 0.05 * sin(t * 0.47 + fi * 2.9), 0.05 * sin(t * 0.29 + fi * 1.3) + 0.025 * sin(t * 0.71 + fi));
    float pulse = pow(0.5 + 0.5 * sin(t * (0.9 + 0.7 * a) + fi * 2.4), 5.0);
    float d = length(pb - at);
    float glow = pulse * (smoothstep(1.4 * px, 0.3 * px, d) + 0.4 * exp(-d * d / (0.00015 + 0.0002 * pulse)));
    rgb += vec3(0.65, 1.0, 0.35) * glow;
    tone = max(tone, glow);
  }

  // Nearest pines frame the clearing from the edges, almost black, with
  // the fire catching their inner edges.
  vec2 pn = p - look * 0.13;
  vec3 near = campfire_row(pn, 0.3, -0.56, vec2(0.8, 1.1), 9.0, 0.3 * aspect, fireBase, px);
  vec3 nearRim = vec3(1.0, 0.42, 0.1) * near.y * 1.6 * flicker + vec3(0.4, 0.5, 0.8) * near.z * 0.3;
  rgb = mix(rgb, vec3(0.006, 0.006, 0.01) + nearRim, near.x);
  tone = mix(tone, clamp(near.y * 1.2 * flicker + near.z * 0.25, 0.0, 1.0), near.x);

  // Tones above are perceived brightness; the engine reads tone as ink
  // coverage, which grows closer to linear light.
  return vec4(rgb, pow(clamp(tone, 0.0, 1.0), 1.8));
}

// field() runs first and colorField() right after it at the same uv, so
// keep the last result instead of painting the whole scene twice.
vec4 campfire_last = vec4(0.0);
vec2 campfire_lastUv = vec2(-1.0);

vec4 campfire_paint(vec2 uv, vec2 res, float t) {
  if (uv != campfire_lastUv) {
    campfire_last = campfireScene(uv, res, t);
    campfire_lastUv = uv;
  }
  return campfire_last;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return campfire_paint(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 rgb = campfire_paint(uv, res, t).rgb;
  // Glyph density already carries brightness, so lift dim hues toward full
  // strength instead of drawing near-black glyphs.
  float peak = max(rgb.r, max(rgb.g, rgb.b));
  return rgb / max(peak, 0.0001) * mix(0.45, 1.0, sqrt(clamp(peak, 0.0, 1.0)));
}
`;

// Colour modes that paint their own colours need a night behind them in
// both themes; mono and palette keep the theme's (or phosphor's) paper.
const NIGHT = "#05060c";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

export interface CampfireWoodsSceneProps extends AsciiSceneProps {
  /** Flame height, from 0.4 to 1.6. Default 1. */
  flame?: number;
  /** How many sparks rise, from 0 to 2. Default 1. */
  sparks?: number;
  /** Smoke over the fire, from 0 to 1.5. Default 1. */
  smoke?: number;
  /** How many fireflies wander the clearing, from 0 to 12. Default 9. */
  fireflies?: number;
  /** Star density, from 0 to 2. Default 1. */
  stars?: number;
  /** How far the pointer leans the flames, from 0 to 2. Default 1. */
  breeze?: number;
  /**
   * Paper behind the glyphs. Default: a deep night colour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
}

/** Ember Woods & Fireflies. A campfire's rising flame and drifting sparks among pine silhouettes, with softly pulsing fireflies. */
export const CampfireWoodsScene = ({
  flame = 1,
  sparks = 1,
  smoke = 1,
  fireflies = 9,
  stars = 1,
  breeze = 1,
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 4,
  interactive = true,
  ...props
}: CampfireWoodsSceneProps) => {
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
        campBreeze: breeze,
        campFireflies: fireflies,
        campFlame: flame,
        campInteract: interactive ? 1 : 0,
        campSmoke: smoke,
        campSparks: sparks,
        campStars: stars,
      }}
      {...props}
    />
  );
};

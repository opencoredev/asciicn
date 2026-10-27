"use client";

import type { AsciiColor, ColorMode } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { AsciiShader } from "@/lib/ascii/shader";

// The tunnel is drawn in log-polar space around the vanishing point: angle
// around it, and the log of the distance from it. Stars flying past move
// outward at a speed proportional to their distance, which in log space is
// a constant scroll, so one sliding grid of hashed cells holds every star
// for its whole flight. Returns the light as rgb and the glyph density as a.
const SCENE = `
const float WARP_TAU = 6.28318530718;

// One layer of streaking stars. lanes is how many stars fit around the
// circle; depth how many fit per unit of log distance. Each star is a
// thin radial streak whose tail trails back toward the vanishing point.
float warp_stars(float angle, float logR, float r, float t, float lanes, float depth, float streak, float keep, float seed, float px) {
  float a = angle / WARP_TAU * lanes;
  float w = (logR - t) * depth;
  float lane = floor(a);
  float fx = a - lane;
  float light = 0.0;
  // A streak's tail can reach back past its own cell, so look at this
  // cell and the two ahead of it.
  for (int j = 0; j < 3; j++) {
    vec2 cell = vec2(lane, floor(w) + float(j));
    float h = hash21(cell + seed);
    if (h > keep) {
      continue;
    }
    h /= keep;
    float at = 0.2 + 0.6 * hash21(cell + seed + 7.0);
    float head = cell.y + 0.2 + 0.7 * hash21(cell + seed + 3.0);
    // Across the streak: the angular gap turned into screen distance.
    float across = abs(fx - at) * WARP_TAU / lanes * r;
    // Along it, in cells: 0 at the head, growing toward the tail.
    float along = head - w;
    float len = streak * (0.5 + 1.0 * h);
    float body = smoothstep(-0.06, 0.02, along) * sqrt(smoothstep(len, 0.0, along));
    float core = smoothstep(1.3 * px, 0.25 * px, across);
    light += body * core * (0.55 + 0.45 * h);
  }
  return light;
}

vec3 warp_shift(float x, float boost) {
  // Blue ahead (x = 0, near the vanishing point), white abreast, red
  // trailing off at the edges; a boost pushes both ends further.
  x = clamp(x, 0.0, 1.0);
  vec3 ahead = mix(vec3(0.45, 0.6, 1.0), vec3(0.6, 0.35, 1.0), boost);
  vec3 behind = mix(vec3(1.0, 0.45, 0.25), vec3(1.0, 0.2, 0.3), boost);
  vec3 c = mix(ahead, vec3(0.95, 0.97, 1.0), smoothstep(0.0, 0.45, x));
  return mix(c, behind, smoothstep(0.5, 1.0, x));
}

vec4 warpScene(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  float px = 1.0 / res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // The vanishing point eases toward the pointer and idles in a slow loop.
  vec2 steer = (u_pointer.xy - 0.5) * vec2(aspect, 1.0) * 0.6 * u_pointer.z * warpInteract;
  vec2 center = steer + vec2(0.05 * sin(t * 0.31), 0.035 * sin(t * 0.43 + 1.0));
  vec2 q = p - center;
  float r = max(length(q), 0.0001);
  float logR = log(r);

  // A press fires the drive: streaks stretch, colours shift and a ring of
  // light leaves the centre. It fades over about two seconds.
  float age = max(u_click.z, 0.0);
  float boost = warpInteract * exp(-age * 1.5);
  float travel = t * warpSpeed * 0.55;

  // Spiral twist: the angle turns with depth, so every lane is a log spiral.
  float angle = atan(q.y, q.x) + warpTwist * logR * 0.6 + t * 0.05 * warpTwist;
  float wrapped = mod(angle, WARP_TAU);

  // Tunnel walls: ribs along the depth and bands around it, fading into
  // the dark ahead.
  float depth = 0.1 / r;
  float z = depth + travel * 1.6;
  float panel = fbm(vec2(wrapped / WARP_TAU * 16.0, floor(z * 2.0) * 0.37));
  float rings = pow(0.5 + 0.5 * cos(z * WARP_TAU * 2.0), 6.0);
  float seams = pow(0.5 + 0.5 * cos(wrapped * 12.0), 24.0);
  float wallFade = smoothstep(0.03, 0.4, r) * exp(-depth * 0.06);
  float wall = (0.18 + 0.32 * panel + 0.55 * rings + 0.3 * seams) * wallFade * warpWalls;
  vec3 wallColor = mix(vec3(0.22, 0.12, 0.55), vec3(0.05, 0.6, 0.75), panel) * wall;
  float tone = wall * 0.85;
  vec3 rgb = wallColor;

  // Three star layers, coarse to fine; finer lanes are fainter and slower.
  float stretch = warpStreak * (1.0 + 3.0 * boost) * (0.6 + 0.4 * warpSpeed);
  float s1 = warp_stars(wrapped, logR, r, travel * 1.0, 40.0, 1.4, 1.1 * stretch, 0.3 * warpDensity, 1.0, px);
  float s2 = warp_stars(wrapped, logR, r, travel * 0.8, 80.0, 2.2, 1.0 * stretch, 0.2 * warpDensity, 2.0, px) * 0.8;
  float s3 = warp_stars(wrapped, logR, r, travel * 0.6, 140.0, 3.2, 0.9 * stretch, 0.14 * warpDensity, 3.0, px) * 0.6;
  float stars = (s1 + s2 + s3) * smoothstep(0.015, 0.08, r);
  // Closer stars are brighter.
  stars *= 0.45 + 0.75 * smoothstep(0.05, 0.6, r);
  vec3 starColor = warp_shift(r / (0.75 * aspect * 0.6 + 0.2), boost);
  rgb += starColor * stars * 1.3;
  tone = max(tone, min(stars * 1.15, 1.0));

  // Now and then a ring of light races out of the tunnel.
  float epoch = floor(t * 0.28);
  float phase = fract(t * 0.28);
  float ringAt = -3.2 + phase * 4.0;
  float ring = step(0.45, hash21(vec2(epoch, 9.0))) * exp(-pow((logR - ringAt) * 7.0, 2.0)) * (1.0 - phase);
  // The boost's own ring.
  float boostAt = -3.0 + age * 3.2;
  ring += warpInteract * exp(-pow((logR - boostAt) * 6.0, 2.0)) * exp(-age * 1.2) * step(age, 3.0);
  ring *= 0.6 + 0.4 * fbm(vec2(wrapped * 3.0, t));
  rgb += mix(vec3(0.5, 0.75, 1.0), vec3(1.0, 0.8, 0.95), boost) * ring;
  tone = max(tone, ring * 0.85);

  // The light at the end: a small hot core and a wide halo.
  float glow = exp(-r * (8.0 - 3.0 * boost)) * (0.7 + 0.3 * boost) + exp(-r * 40.0);
  rgb += vec3(0.75, 0.85, 1.0) * glow;
  tone = max(tone, glow);

  // Tones above are perceived brightness; the engine reads tone as ink
  // coverage, which grows closer to linear light.
  return vec4(rgb, pow(clamp(tone, 0.0, 1.0), 1.8));
}

// field() runs first and colorField() right after it at the same uv, so
// keep the last result instead of painting the whole scene twice.
vec4 warp_last = vec4(0.0);
vec2 warp_lastUv = vec2(-1.0);

vec4 warp_paint(vec2 uv, vec2 res, float t) {
  if (uv != warp_lastUv) {
    warp_last = warpScene(uv, res, t);
    warp_lastUv = uv;
  }
  return warp_last;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return warp_paint(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 rgb = warp_paint(uv, res, t).rgb;
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

export interface WarpTunnelSceneProps extends AsciiSceneProps {
  /** Flight speed, from 0.2 to 3. Separate from `speed`, which scales all motion. Default 1. */
  velocity?: number;
  /** Streak length, from 0.2 to 3. Default 1. */
  streak?: number;
  /** How many stars fly past, from 0.2 to 2. Default 1. */
  density?: number;
  /** Spiral twist of the lanes, from -1.5 to 1.5. Default 0.35. */
  twist?: number;
  /** Brightness of the tunnel walls, from 0 to 1.5. Default 1. */
  walls?: number;
  /**
   * Paper behind the glyphs. Default: a deep night colour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
}

/** Relativistic Starfield Tunnel. A high-speed wormhole of radially streaking glyphs, with a vanishing point you steer with the pointer. */
export const WarpTunnelScene = ({
  velocity = 1,
  streak = 1,
  density = 1,
  twist = 0.35,
  walls = 1,
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 4,
  interactive = true,
  ...props
}: WarpTunnelSceneProps) => {
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
        warpDensity: density,
        warpInteract: interactive ? 1 : 0,
        warpSpeed: velocity,
        warpStreak: streak,
        warpTwist: twist,
        warpWalls: walls,
      }}
      {...props}
    />
  );
};

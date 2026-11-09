"use client";

import type { ReactNode } from "react";

import { resolveCharset, useAsciiColors } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, PhosphorName } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// A Schwarzschild black hole, traced per sample. Lengths are in units of
// the Schwarzschild radius, so the horizon is r = 1, the photon sphere
// r = 1.5 and the innermost stable orbit r = 3. Each sample casts a ray
// from a camera far off, bends it with the null-geodesic acceleration
// -1.5 h^2 x / r^5 (h is the ray's angular momentum), and adds light where
// it crosses the disk plane. The lensed arcs over and under the shadow are
// those same rays crossing the far side of the disk after they bend, so
// nothing is drawn twice by hand. The photon ring is added from the ray's
// impact parameter instead, because the real one is thinner than a sample.
// `bhScene` is cached per sample because field and colorField both ask.
const SCENE = `
const float BH_CRITICAL = 2.598076;
const float BH_INNER = 3.0;
const float BH_CAMERA = 60.0;

// Stars on a lon/lat grid of the escaped direction. One star at most per
// grid square, about one sample across, so far from the hole each is a
// single glyph or dot; near the edge the lens stretches it into an arc.
float bhStars(vec3 d, vec2 pixel, float t) {
  vec2 a = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0)));
  float spacing = pixel.y * bhCellRows * 7.0;
  vec2 g = a / spacing;
  vec2 id = floor(g);
  float pick = hash21(id + 17.3 + u_seed);
  if (pick < 0.7) {
    return 0.0;
  }
  vec2 centre = (id + 0.2 + 0.6 * vec2(hash21(id + 3.7), hash21(id + 9.1))) * spacing;
  vec2 off = (a - centre) / pixel;
  // Mostly faint points, with the odd bright one.
  float level = hash21(id + 5.3);
  float bright = level > 0.92 ? 0.62 : 0.12 + 0.12 * level;
  // Slow and shallow, so the sky glimmers rather than flickers.
  float twinkle = 0.85 + 0.15 * sin(t * (0.2 + pick * 0.5) + pick * 80.0);
  return bright * twinkle * exp(-dot(off, off) * 2.2);
}

vec3 bhWarm(float heat) {
  vec3 col = mix(vec3(0.55, 0.13, 0.04), vec3(0.98, 0.42, 0.12), smoothstep(0.0, 0.35, heat));
  col = mix(col, vec3(1.0, 0.7, 0.3), smoothstep(0.3, 0.65, heat));
  return mix(col, vec3(1.0, 0.93, 0.78), smoothstep(0.65, 1.0, heat));
}

vec3 bhDeepen(vec3 col) {
  // On light paper, bright amber vanishes: darken and saturate.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 rich = mix(vec3(l), col, 1.3) * 0.6;
  return mix(col, clamp(rich, 0.0, 1.0), bhOnLight);
}

vec2 bhCacheUv = vec2(-1.0);
float bhCacheT = -1.0;
vec4 bhCacheValue = vec4(0.0);

// Returns the colour in rgb and the tone in a.
vec4 bhScene(vec2 uv, vec2 res, float t) {
  if (uv == bhCacheUv && t == bhCacheT) {
    return bhCacheValue;
  }
  float aspect = res.x / res.y;
  // Fit the disk across a wide box, keep the shadow a fair share of a
  // narrow one, and never crop the lensed arcs top and bottom.
  float fit = 1.9 * bhOuter / aspect;
  float zoom = max(11.5, min(fit, 13.5 / aspect)) / bhScale;
  vec2 s = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  // One sample in Schwarzschild radii, rows from the contract and columns
  // from the sample grid, since glyph cells are narrower than they are tall.
  vec2 cellRs = vec2(aspect / ascii_samples.x, 1.0 / res.y) * zoom;

  vec3 cam = BH_CAMERA * vec3(0.0, sin(bhTilt), -cos(bhTilt));
  vec3 fwd = -normalize(cam);
  vec3 right = vec3(1.0, 0.0, 0.0);
  vec3 up = cross(fwd, right);
  vec3 dir = normalize(fwd + (s.x * right + s.y * up) / BH_CAMERA);

  vec3 pos = cam;
  vec3 vel = dir;
  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);
  float b = sqrt(h2);

  float disk = 0.0;
  float heat = 0.0;
  float cover = 0.0;
  bool captured = false;
  for (int i = 0; i < 128; i++) {
    float r = length(pos);
    // Long strides far out, short ones near the photon sphere.
    float dl = clamp(0.1 * (r - 0.8), 0.04, 4.0);
    vec3 acc = -1.5 * h2 * pos / (r * r * r * r * r);
    vec3 mid = vel + 0.5 * dl * acc;
    vec3 next = pos + dl * mid;
    float rn = length(next);
    vel = mid + 0.5 * dl * (-1.5 * h2 * next / (rn * rn * rn * rn * rn));

    if (pos.y * next.y < 0.0) {
      vec3 hit = mix(pos, next, pos.y / (pos.y - next.y));
      float rh = length(hit.xz);
      if (rh > BH_INNER * 0.96 && rh < bhOuter) {
        // Keplerian orbit, anticlockwise seen from above: the left side
        // comes toward the camera.
        vec3 tangent = vec3(-hit.z, 0.0, hit.x) / rh;
        float beta = sqrt(0.5 / rh);
        float gamma = inversesqrt(1.0 - beta * beta);
        float facing = dot(tangent, -normalize(vel));
        float g = sqrt(1.0 - 1.0 / rh) / (gamma * (1.0 - beta * facing));

        // Each radius turns at its own rate, so streaks shear as they flow.
        float omega = 0.22 * pow(BH_INNER / rh, 1.5);
        float ang = atan(hit.z, hit.x) - omega * t;
        vec2 loop = vec2(cos(ang), sin(ang));
        float clumps = fbm(vec2(rh * 1.1, 2.0) + loop * 1.3 + u_seed);
        float streaks = fbm(vec2(rh * 4.2, 7.0) + loop * 1.9 + u_seed);
        float density = clamp(0.25 + 0.75 * clumps + 1.1 * (streaks - 0.5), 0.0, 1.0);

        float inner = smoothstep(BH_INNER * 0.96, BH_INNER * 1.12, rh);
        float outer = 1.0 - smoothstep(bhOuter * 0.35, bhOuter, rh);
        float profile = pow(BH_INNER / rh, 2.0) * inner * outer;
        // Streaks show most in the bright inner disk; the outer disk stays
        // a quiet haze.
        float texture = mix(0.75, 0.3 + 1.0 * density, smoothstep(bhOuter * 0.8, BH_INNER * 1.4, rh));
        float emit = profile * pow(g, bhBeaming) * texture;
        float alpha = clamp(0.3 + 0.7 * density, 0.0, 0.95) * inner * outer;

        float w = (1.0 - cover) * emit;
        disk += w;
        heat += w * clamp((g * pow(BH_INNER / rh, 0.75) - 0.2) * 1.15, 0.0, 1.0);
        cover += (1.0 - cover) * alpha;
      }
    }
    pos = next;
    if (rn < 1.02) {
      captured = true;
      break;
    }
    if (rn > BH_CAMERA && dot(pos, vel) > 0.0) {
      break;
    }
    if (cover > 0.98) {
      break;
    }
  }

  float starLight = 0.0;
  if (!captured && bhShowStars > 0.5 && cover < 0.98) {
    starLight = bhStars(normalize(vel), cellRs / BH_CAMERA, t) * (1.0 - cover);
  }

  // The photon ring: a line a sample or so wide just outside the shadow,
  // brighter on the side that comes toward you.
  float ringDist = (b - BH_CRITICAL) / cellRs.y;
  float ring = exp(-pow(ringDist - 0.5, 2.0) * 1.1) * (1.0 - 0.5 * cover);
  vec2 sn = s / max(length(s), 1e-4);
  ring *= 0.9 - 0.2 * sn.x * (bhBeaming / 2.5);

  float diskTone = 1.0 - exp(-disk * 2.2);
  float ringTone = ring;
  float starTone = starLight;
  float tone = max(max(diskTone, ringTone), starTone);
  // Dots light against an ordered matrix: stretch the range so the hot
  // disk and the ring draw solid and the faint haze thins out.
  tone = mix(tone, smoothstep(0.05, 0.85, tone), bhPacked);

  float heatAvg = disk > 1e-4 ? heat / disk : 0.0;
  vec3 ink = paletteColor(0.0).rgb;
  vec3 accent = paletteColor(1.0).rgb;
  vec3 diskCol;
  vec3 ringCol;
  vec3 starCol;
  if (bhWarmTint > 0.5) {
    diskCol = bhDeepen(bhWarm(heatAvg));
    ringCol = bhDeepen(bhWarm(0.8));
    starCol = bhDeepen(vec3(0.86, 0.9, 1.0));
  } else {
    diskCol = mix(ink, accent, smoothstep(0.25, 0.7, heatAvg));
    ringCol = accent;
    starCol = ink;
  }
  float wd = diskTone + 1e-4;
  vec3 col = (diskCol * wd + ringCol * ringTone + starCol * starTone) / (wd + ringTone + starTone);

  bhCacheUv = uv;
  bhCacheT = t;
  bhCacheValue = vec4(col, tone);
  return bhCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return bhScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec4 colorField(vec2 uv, vec2 res, float t) {
  vec4 scene = bhScene(uv, res, t);
  // Faint glyphs sit back toward the paper, so the hot disk reads nearest.
  // Dots are either lit or not, so they keep full colour.
  float fade = mix(mix(0.55, 1.0, smoothstep(0.0, 0.7, scene.a)), 1.0, bhPacked);
  return vec4(scene.rgb, fade);
}
`;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(circle at 50% 50%, var(--ascii-paper) 0 9%, var(--ascii-color-orange) 10%, transparent 13%), linear-gradient(to bottom, transparent 48%, color-mix(in oklab, var(--ascii-color-orange) 45%, transparent) 50%, transparent 52%)",
    }}
  />
);

/** Samples per glyph cell, top to bottom, for each charset kind. */
const CELL_ROWS = {
  braille: 4,
  edge: 1,
  quadrants: 2,
  ramp: 1,
} as const satisfies Record<string, number>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** True when the paper is light, so the warm tint deepens. */
const usePaperIsLight = (
  paper: AsciiColor,
  phosphor: PhosphorName | undefined
) => {
  const colors = useAsciiColors(undefined, [paper]);
  const rgba = colors?.[0];
  if (phosphor !== undefined || rgba === undefined) {
    return false;
  }
  return 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2] > 0.55;
};

export interface BlackHoleProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How far above the disk plane you look from, in degrees. 0 is edge-on. Default 8. */
  tilt?: number;
  /** How fast the disk turns. 0 holds it still. Default 1. */
  speed?: number;
  /** Outer radius of the disk, from 0.5 to 2 times the default. Default 1. */
  diskSize?: number;
  /** How much the hole fills the box, from 0.5 to 1.5. Default 1. */
  scale?: number;
  /** How much brighter the side turning toward you is, from 0 (even) to 2. Default 1. */
  beaming?: number;
  /** `"theme"`: ink with an amber-hot inner disk. `"warm"`: a fixed palette from deep red to white-hot. Default `"theme"`. */
  tint?: "theme" | "warm";
  /** Stars behind the hole, bent and stretched near its edge. Default `true`. */
  stars?: boolean;
  /** The cool, outer colour of the disk and the stars in the theme tint. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The hot inner disk and the photon ring in the theme tint. Default `"orange"`. */
  accent?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a ring and a disk in the theme's colours. */
  fallback?: ReactNode;
}

/**
 * Black hole. A thin accretion disk seen close to edge-on, its far side
 * lensed into arcs over and under a black shadow, a photon ring hugging
 * the shadow and the near side brighter where it turns toward you.
 * Streaks flow round the disk and background stars bend near the edge.
 * Every ray is traced through curved space on the GPU. It does not react
 * to the pointer.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const BlackHole = ({
  tilt = 8,
  speed = 1,
  diskSize = 1,
  scale = 1,
  beaming = 1,
  tint = "theme",
  stars = true,
  ink = "--ascii-ink",
  accent = "orange",
  paper = "--ascii-paper",
  charset = "standard",
  chars,
  colorMode,
  phosphor,
  dither,
  cell = 12,
  fps = 30,
  stillTime = 6,
  fallback = FALLBACK,
  ...props
}: BlackHoleProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  const { kind } = resolveCharset(charset, chars);
  // Dots light only above half tone; an ordered matrix keeps the faint
  // outer disk as a dot gradient instead of dropping it.
  const packed = kind === "braille" || kind === "quadrants";
  const glass = phosphor === undefined;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        bhBeaming: 2.5 * clamp(beaming, 0, 2),
        bhCellRows: CELL_ROWS[kind],
        bhOnLight: onLight ? 1 : 0,
        bhOuter: 3 + 7 * clamp(diskSize, 0.5, 2),
        bhPacked: packed ? 1 : 0,
        bhScale: clamp(scale, 0.5, 1.5),
        bhShowStars: stars ? 1 : 0,
        bhTilt: (clamp(tilt, -80, 80) * Math.PI) / 180,
        bhWarmTint: tint === "warm" ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={dither ?? (packed ? "bayer4" : "none")}
      palette={[paper, ink, accent]}
      ink={glass ? ink : undefined}
      paper={glass ? paper : undefined}
      speed={speed}
      cell={cell}
      fps={fps}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

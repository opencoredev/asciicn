"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The canyon is painted near to far: eroded near walls, a middle wall, two
// rows of buttes at the sides and a hazy plateau on the horizon. The near
// and middle walls open around the river, so the one winding band of water
// shows through each gap in turn and runs from the low sun towards you.
// Terrain is laid out in its own height, ty, with the horizon at 0.5; on
// tall boxes the real horizon rises and the ground below it is squeezed to
// fit, so the sun sits above a centred headline. It is late golden hour:
// rock turned to the sun is warm terracotta and rust, rock in shade takes
// the blue of the sky, and only the sunlit rims draw the largest dots.
// Only light moves: the glow on the rims, the shimmer on the water and the
// clouds.
const SCENE = `
const float CANYON_FLOOR_M = 0.27;
const float CANYON_FLOOR_F = 0.44;

// Set once per sample by canyonScene and read by every layer.
float canyonT;
float canyonW;
float canyonHz;
float canyonSun;
float canyonRow;
float canyonGapN;
float canyonGapM;
float canyonGapF;
float canyonHalfN;
float canyonHalfM;
float canyonHalfF;
float canyonRimN;
float canyonRimM;
float canyonWet;
float canyonCalm;

// A stable random value per cell. hash21 repeats on integers, which tiles patterns.
float canyonHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Soft benches: mostly slope, with a short ledge at each step.
float canyonBench(float v, float n) {
  float q = clamp(v, 0.0, 1.0) * n;
  return (floor(q) + smoothstep(0.22, 0.96, fract(q))) / n;
}

// The river's centre at terrain height ty: it leaves the low sun, swings
// right, then crosses back to the left as it comes near. Perspective
// narrows the swing towards the horizon.
float canyonRiverX(float ty) {
  float u = clamp((0.5 - ty) / 0.5, 0.0, 1.3);
  return mix(canyonSun, -0.08 * canyonW, u) + canyonW * 0.26 * pow(u, 0.8) * sin(u * 5.2 + 0.3);
}

float canyonRiverHalf(float ty) {
  return 0.003 + 0.13 * pow(max(0.5 - ty, 0.0), 1.25);
}

// A canyon wall opening around gap: an eroded slope with two soft benches,
// buttresses and notches along the rim, and fine breaks near the top.
float canyonWall(float x, float gap, float halfGap, float span, float floorY, float rim, float rough) {
  float d = abs(x - gap) - halfGap;
  float v = d / max(span, 0.05) + 0.16 * (fbm(vec2(x * 3.2, rim * 40.0)) - 0.5);
  float s = clamp(v, 0.0, 1.0);
  float prof = mix(pow(s, 0.75), canyonBench(s, 2.0), 0.4);
  float top = mix(floorY, rim, prof);
  return top + rough * (0.7 * snoise(vec2(x * 16.0, rim * 9.0)) + 0.3 * snoise(vec2(x * 47.0, rim * 3.0)));
}

float canyonNearTop(float x) {
  float left = step(x, canyonGapN);
  float span = (mix(canyonW - canyonGapN, canyonW + canyonGapN, left) - canyonHalfN) * 0.7;
  canyonRimN = mix(0.31, 0.37, left) + 0.09 * (fbm(vec2(x * 2.2, 9.2)) - 0.5);
  return canyonWall(x, canyonGapN, canyonHalfN, span, -0.08, canyonRimN, 0.008);
}

float canyonMidTop(float x) {
  canyonRimM = 0.42 + 0.07 * (fbm(vec2(x * 2.6, 6.1)) - 0.5);
  return canyonWall(x, canyonGapM, canyonHalfM, 0.38 * canyonW + 0.05, CANYON_FLOOR_M, canyonRimM, 0.008);
}

// One butte: a rough cap rock with sheer, jagged sides over a talus skirt.
// Returns which side of it the point is on, from -1 (away from the sun) to
// 1 (towards it), or -9 outside it. top is set to its rim above x.
float canyonButte(float x, float ty, float cx, float hw, float topY, float cap, float rough, out float top) {
  top = topY + rough * (0.7 * snoise(vec2(x * 20.0, cx * 7.0)) + 0.5 * snoise(vec2(x * 61.0, cx * 3.0)));
  if (ty > top || ty < CANYON_FLOOR_F) {
    return -9.0;
  }
  float base = topY - cap;
  float w = hw + max(base - ty, 0.0) * 1.3;
  w += rough * (1.6 * snoise(vec2(ty * 52.0, cx * 13.0)) + 2.2 * snoise(vec2(ty * 12.0, cx * 5.0)));
  float d = x - cx;
  if (abs(d) > w) {
    return -9.0;
  }
  return clamp(d / max(w, 1e-3), -1.0, 1.0) * sign(canyonSun - cx);
}

// The light of the setting sun sliding slowly along the rims, like the
// shadow of a cloud passing over them. Strongest on the sun's side.
float canyonLight(float x) {
  float n = snoise(vec2(x * 1.5 - canyonT * 0.014, 2.0));
  return (0.5 + 0.5 * smoothstep(-0.35, 0.55, n)) * (0.6 + 0.4 * exp(-abs(x - canyonSun) * 1.2));
}

// Rock with internal structure. Upright buttresses that lean and vary in
// width are split into planes with a sharp edge between them: on the
// sunward wall, warm sunlit planes beside shaded ones; on the shadow wall,
// cool planes that catch the sky beside darker ones. Each facet keeps its
// own tone. Broken benches run across at irregular heights, lit on top
// with shadow under the ledge, and erosion gullies branch down from the
// rim. side is -1 on a face turned from the sun and 1 on one turned to it;
// detail scales all of this, less with distance and in the calm middle;
// bounce is cool light reflected up from the river onto shaded rock.
vec3 canyonStone(
  float x, float ty, float side, float top, float base, float freq, float bench,
  float detail, float bounce, vec3 lit, vec3 shade, vec3 rim, vec3 haze,
  float hazeAmt, float light
) {
  float sunDir = sign(canyonSun - x);
  float h = clamp((ty - base) / max(top - base, 1e-3), 0.0, 1.0);
  detail *= 1.0 - 0.6 * canyonCalm;
  float litSide = smoothstep(-0.12, 0.12, side);
  vec3 sky = shade * 1.4 + vec3(0.06, 0.1, 0.22);

  // Planes: which way each buttress face turns, with a hard edge.
  vec2 q = vec2(x * freq + ty * freq * 0.45, ty * freq * 0.18 + freq);
  float r0 = fbm(q - vec2(0.18, 0.0));
  float r1 = fbm(q + vec2(0.18, 0.0));
  float plane = smoothstep(-0.015, 0.015, (r0 - r1) * sunDir + 0.03 * side);
  float facet = canyonHash(vec2(floor((r0 + r1) * 5.0), floor(ty * freq * 0.6)));
  float sunny = litSide * mix(1.0, plane, 0.7 * detail);
  vec3 col = mix(shade, lit, sunny * (0.75 + 0.25 * light));
  col = mix(col, sky, 0.5 * (1.0 - litSide) * plane * detail);
  col *= (0.74 + 0.26 * h) * (1.0 + 0.22 * (facet - 0.5) * detail);

  // Benches: a level every bench or so, wavy and broken, some skipped.
  if (bench > 0.0) {
    float f = (ty - base) / bench + 0.8 * fbm(vec2(x * 1.6, bench * 50.0)) + 0.3 * snoise(vec2(x * 5.0, ty * 4.0));
    float idx = floor(f);
    float fr = fract(f);
    float present = smoothstep(-0.2, 0.2, snoise(vec2(x * 3.2 + idx * 1.7, idx * 5.3)));
    present *= step(0.3, canyonHash(vec2(idx, bench * 100.0))) * detail;
    float ledge = (1.0 - smoothstep(0.0, 0.22, fr)) * present;
    float under = smoothstep(0.78, 0.98, fr) * present;
    col = mix(col, mix(sky * 1.35, mix(lit, rim, 0.45), litSide), ledge * (0.6 + 0.3 * light * litSide));
    col *= 1.0 - 0.6 * under;
  }

  // Gullies: a winding trunk channel with smaller ones feeding it from above.
  vec2 g = vec2(x * freq * 1.7 + 0.9 * fbm(vec2(x * freq * 0.6, ty * freq * 0.5)), ty * freq * 0.32);
  float trunk = smoothstep(0.9, 0.975, 1.0 - abs(snoise(g)));
  float twig = smoothstep(0.92, 0.98, 1.0 - abs(snoise(g * 2.2 + 7.3))) * (0.25 + 0.75 * h);
  float gully = clamp(trunk + 0.8 * twig, 0.0, 1.0) * detail;
  col = mix(col, shade * 0.6 + vec3(0.0, 0.02, 0.06), gully * 0.8);

  // Light reflected up from the river onto rock in shade, strongest low down.
  col = mix(col, vec3(0.24, 0.38, 0.66), bounce * (1.0 - sunny) * (0.35 + 0.65 * (1.0 - h)));

  float rows = (top - ty) / canyonRow;
  float edge = rows < 1.2 ? 1.0 : 0.45 * exp(-(rows - 1.2) * 0.6);
  col = mix(col, rim, edge * light * litSide * (0.55 + 0.45 * plane));
  // Rims turned away from the sun catch the cool sky instead.
  col = mix(col, vec3(0.4, 0.56, 0.86), edge * 0.55 * (1.0 - litSide));
  return mix(col, haze, hazeAmt * (0.75 + 0.25 * (1.0 - h)));
}

// The sky from the gold at the horizon to indigo overhead, warmest under
// the sun and coolest away from it. y is the real height.
vec3 canyonSkyColor(float x, float y) {
  float e = clamp((y - canyonHz) / (1.0 - canyonHz), 0.0, 1.0);
  float near = exp(-abs(x - canyonSun) * 2.0);
  vec3 col = vec3(0.13, 0.27, 0.56);
  col = mix(vec3(0.24, 0.44, 0.76), col, smoothstep(0.3, 0.95, e));
  col = mix(vec3(0.5, 0.68, 0.9), col, smoothstep(0.08, 0.4, e));
  col = mix(mix(vec3(0.96, 0.76, 0.52), vec3(1.0, 0.84, 0.52), near), col, smoothstep(0.02, 0.18, e));
  col = mix(mix(vec3(0.96, 0.66, 0.36), vec3(1.0, 0.74, 0.36), near), col, smoothstep(0.0, 0.07, e));
  return col;
}

// The glow of the sun just under the horizon, wide and flattened, with a
// slow breath.
float canyonGlow(float x, float y) {
  vec2 d = vec2((x - canyonSun) * 0.5, (y - canyonHz - 0.05) * 1.2);
  float r = length(d);
  return (0.9 + 0.08 * sin(canyonT * 0.25)) * (exp(-r * 16.0) + 0.22 * exp(-r * 7.0));
}

vec3 canyonSky(float x, float y) {
  vec3 col = canyonSkyColor(x, y);
  float e = (y - canyonHz) / (1.0 - canyonHz);
  col = mix(col, vec3(1.0, 0.86, 0.56), clamp(canyonGlow(x, y), 0.0, 1.0));
  // The sun itself, low over the plateau.
  float disc = length(vec2(x - canyonSun, y - canyonHz - 0.05));
  col = mix(col, vec3(1.0, 0.96, 0.84), 1.0 - smoothstep(0.034, 0.042, disc));
  // Thin streaks of cloud, gold on their undersides, drifting slowly.
  float band = smoothstep(0.14, 0.26, e) * (1.0 - smoothstep(0.5, 0.66, e));
  float wisp = fbm(vec2(x * 1.4 + canyonT * 0.006, y * 9.0 - 3.0));
  float cloud = band * smoothstep(0.62, 0.74, wisp) * canyonCloudsOn;
  vec3 lit = mix(vec3(0.94, 0.9, 0.86), vec3(1.0, 0.86, 0.56), exp(-abs(x - canyonSun) * 1.6));
  col = mix(col, lit, cloud * 0.4);
  return col;
}

// The water mirrors the sky above it: gold far off under the sun, clear
// blue close by, where you look down into it. Streaks of shimmer slide
// slowly across it.
vec3 canyonWater(float x, float ty) {
  float depth = 0.5 - ty;
  vec3 col = canyonSkyColor(x, canyonHz + 0.06 + depth * 0.3) * 1.1 + vec3(0.0, 0.03, 0.07);
  float sun = exp(-abs(x - canyonSun) * 5.0) * exp(-depth * 3.5);
  col = mix(col, vec3(1.0, 0.82, 0.52), clamp(sun * 1.4, 0.0, 1.0));
  float streak = snoise(vec2(x * 7.0 + canyonT * 0.05, ty * 85.0 - canyonT * 0.22));
  col *= 0.8 + 0.3 * smoothstep(-0.1, 0.8, streak);
  float glint = smoothstep(0.86, 0.95, snoise(vec2(x * 22.0 - canyonT * 0.03, ty * 140.0 + canyonT * 0.12)));
  return mix(col, vec3(1.0, 0.9, 0.7), glint * (0.3 + 0.7 * sun));
}

// The canyon floor where no wall covers it: dark scrub and sand along the
// water, hazier with distance.
vec3 canyonFloor(float x, float ty) {
  float d = abs(x - canyonRiverX(ty));
  float hw = canyonRiverHalf(ty);
  canyonWet = 1.0 - step(hw, d);
  if (d < hw) {
    return canyonWater(x, ty);
  }
  float far = smoothstep(0.15, 0.5, ty);
  vec3 ground = mix(vec3(0.07, 0.1, 0.2), vec3(0.3, 0.3, 0.4), far);
  float bank = 1.0 - smoothstep(hw, hw + 0.01 + hw * 0.5, d);
  ground = mix(ground, mix(vec3(0.38, 0.26, 0.16), vec3(0.62, 0.48, 0.36), far), bank * 0.7);
  return ground * (0.85 + 0.3 * fbm(vec2(x * 9.0, ty * 30.0)));
}

vec2 canyonCacheUv = vec2(-1.0);
float canyonCacheT = -1.0;
vec4 canyonCacheValue = vec4(0.0);

vec4 canyonScene(vec2 uv, vec2 res, float t) {
  if (uv == canyonCacheUv && t == canyonCacheT) {
    return canyonCacheValue;
  }
  float aspect = res.x / res.y;
  // Tall boxes narrow the view less than they crop it, so the river, both
  // walls and the sun stay in frame on a phone.
  float zoom = clamp(aspect / 1.5, 0.55, 1.0);
  float x = (uv.x - 0.5) * aspect / zoom;
  float y = uv.y;
  // On tall boxes the horizon rises above the middle, where a headline sits.
  canyonHz = mix(0.66, 0.5, smoothstep(0.75, 1.3, aspect));
  float ty = y < canyonHz ? y * 0.5 / canyonHz : 0.5 + (y - canyonHz);
  // One value per dot, so a jitter never splits across two glyph columns.
  vec2 cell = floor(uv * ascii_samples / vec2(canyonPitch, 1.0));
  canyonT = t;
  // The middle of the box, where a headline sits, keeps less detail.
  canyonCalm = (1.0 - smoothstep(0.2, 0.3, abs(uv.x - 0.5))) * (1.0 - smoothstep(0.15, 0.24, abs(uv.y - 0.52)));
  canyonRow = 0.5 / canyonHz / res.y;
  canyonW = 0.5 * aspect / zoom;
  // Right of the middle on wide boxes, clear of a centred headline.
  canyonSun = canyonW * mix(0.5, 0.62, smoothstep(0.7, 1.6, aspect));
  canyonGapN = canyonRiverX(0.06);
  canyonGapM = canyonRiverX(0.33);
  canyonGapF = canyonRiverX(0.46);
  canyonHalfN = canyonRiverHalf(0.06) + 0.03;
  canyonHalfM = canyonRiverHalf(0.33) + 0.02;
  canyonHalfF = canyonRiverHalf(0.46) + 0.01;

  vec3 col;
  // Ground draws on a steeper tone curve than sky, so lit rock reaches the
  // middle dot while shadow stays on the smallest. solid shifts a layer.
  float ground = 1.0;
  float solid = 0.0;
  float topN = canyonNearTop(x);
  float topM = canyonMidTop(x);
  // Buttes beside the sun, never in the middle: a nearer row in front
  // of a hazier one, overlapping, on both sides.
  float clear = smoothstep(0.06, 0.13, abs(x - canyonSun)) * smoothstep(canyonHalfF, canyonHalfF + 0.05, abs(x - canyonGapF));
  float top1 = 0.0;
  float side1 = -9.0;
  float tb;
  float s = canyonButte(x, ty, -0.66 * canyonW, 0.045, 0.565, 0.035, 0.005, tb);
  if (s > -2.0) { side1 = s; top1 = tb; }
  s = canyonButte(x, ty, -0.9 * canyonW, 0.1, 0.61, 0.05, 0.006, tb);
  if (side1 < -2.0 && s > -2.0) { side1 = s; top1 = tb; }
  s = canyonButte(x, ty, 0.93 * canyonW, 0.09, 0.59, 0.045, 0.006, tb);
  if (side1 < -2.0 && s > -2.0) { side1 = s; top1 = tb; }
  float top2 = 0.0;
  float side2 = -9.0;
  s = canyonButte(x, ty, -0.76 * canyonW, 0.05, 0.585, 0.06, 0.003, tb);
  if (s > -2.0) { side2 = s; top2 = tb; }
  s = canyonButte(x, ty, -0.52 * canyonW, 0.025, 0.535, 0.02, 0.003, tb);
  if (side2 < -2.0 && s > -2.0) { side2 = s; top2 = tb; }
  s = canyonButte(x, ty, 0.8 * canyonW, 0.035, 0.56, 0.04, 0.003, tb);
  if (side2 < -2.0 && s > -2.0) { side2 = s; top2 = tb; }
  float topH = 0.5 + 0.005 + 0.012 * fbm(vec2(x * 2.2, 12.0));
  topH = mix(0.494, topH, smoothstep(0.012, 0.05, abs(x - canyonSun)));

  if (ty < topN) {
    float side = clamp((canyonGapN - x) / 0.12, -1.0, 1.0) * sign(canyonSun - canyonGapN);
    col = canyonStone(
      x, ty, side, topN, -0.08, 3.8, 0.06, 1.0,
      0.32 + 0.35 * exp(-abs(x - canyonGapN) * 2.5),
      vec3(0.86, 0.4, 0.18), vec3(0.08, 0.13, 0.27), vec3(1.0, 0.66, 0.32),
      vec3(0.06, 0.1, 0.2), 0.06, canyonLight(x)
    );
    solid = 0.02;
  } else if (ty < topM && ty > CANYON_FLOOR_M) {
    float side = clamp((canyonGapM - x) / 0.08, -1.0, 1.0) * sign(canyonSun - canyonGapM);
    col = canyonStone(
      x, ty, side, topM, CANYON_FLOOR_M, 4.4, 0.036, 1.0, 0.12,
      vec3(0.88, 0.48, 0.24), vec3(0.12, 0.18, 0.34), vec3(1.0, 0.72, 0.4),
      vec3(0.2, 0.26, 0.4), 0.18, canyonLight(x)
    );
  } else if (side1 > -2.0 && clear > 0.5) {
    col = canyonStone(
      x, ty, side1, top1, CANYON_FLOOR_F, 5.0, 0.03, 0.5, 0.0,
      vec3(0.96, 0.58, 0.32), vec3(0.2, 0.26, 0.42), vec3(1.0, 0.8, 0.5),
      vec3(0.4, 0.42, 0.52), 0.18, canyonLight(x)
    );
  } else if (side2 > -2.0 && clear > 0.5) {
    col = canyonStone(
      x, ty, side2, top2, CANYON_FLOOR_F, 4.0, 0.0, 0.3, 0.0,
      vec3(0.82, 0.58, 0.42), vec3(0.32, 0.38, 0.54), vec3(1.0, 0.8, 0.56),
      vec3(0.5, 0.52, 0.62), 0.45, canyonLight(x)
    );
  } else if (ty < topH && ty > 0.47) {
    col = canyonStone(
      x, ty, 0.0, topH, 0.47, 3.0, 0.0, 0.0, 0.0,
      vec3(0.94, 0.66, 0.42), vec3(0.52, 0.54, 0.66), vec3(1.0, 0.84, 0.58),
      vec3(0.9, 0.7, 0.52), 0.6, canyonLight(x)
    );
  } else if (ty < 0.5) {
    col = canyonFloor(x, ty);
    solid = 0.14 * canyonWet;
  } else {
    col = canyonSky(x, y);
    ground = 0.0;
    // Clear blue reads as quiet air: its dots grow more slowly with brightness
    // than the glow's, so only the sun and its halo draw the largest.
    float lumSky = dot(col, vec3(0.299, 0.587, 0.114));
    // A fixed jitter per dot mixes neighbouring dot sizes where the sky
    // crosses from one to the next, instead of a hard stepped contour.
    solid = 0.08 * (canyonHash(cell + 41.0) - 0.5) - 0.26 * lumSky + 0.45 * clamp(canyonGlow(x, y), 0.0, 1.0);
  }

  // Dot size follows brightness. The dots ramp switches at about 0.1, 0.35
  // and 0.75: shadow and the high sky stay on the smallest dot, lit rock
  // takes the middle one, and only light and sunlit rims the largest.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float tone = mix(1.25 * lum - 0.02, 0.06 + 1.45 * lum, ground) + solid;
  tone = clamp(tone, 0.0, 1.0);
  // Without square cells a dot glyph's cell is half as wide as it is tall,
  // so dots light every other column to keep the grid of dots square.
  if (canyonPitch > 1.5 && mod(floor(uv.x * ascii_samples.x), 2.0) > 0.5) {
    tone = 0.0;
  }
  canyonCacheUv = uv;
  canyonCacheT = t;
  // Intensity dims colour in step and shrinks dots gently. It quiets the
  // middle of the box, where a headline sits, more than the edges.
  float calm = 1.0 - smoothstep(0.2, 0.75, length((uv - 0.5) * vec2(1.2, 2.0)));
  float k = mix(1.0, canyonIntensity, mix(0.6, 1.0, calm));
  canyonCacheValue = vec4(col * k, tone * (0.7 + 0.3 * k));
  return canyonCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return canyonScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return canyonScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its deep blue behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const DEEP_BLUE = "#070c1a";
const DEEP_BLUE_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0b1d44 0%, #2c5590 30%, #e8a25a 50%, #6a2e16 56%, #0a1022 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface CanyonRiverProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Thin streaks of cloud drifting across the sky. Default `true`. */
  clouds?: boolean;
  /**
   * Paper behind the glyphs. Default: a deep blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on dark. */
  ramp?: AsciiSceneProps["ramp"];
  /** Cells as wide as they are tall, so `dots` lay an even halftone lattice. Default `true`. */
  square?: boolean;
  /** Shown without WebGL and until the first frame. Default: the scene as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the canyon never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A desert canyon in late golden hour from a high rim. Carved walls of
 * sunlit terracotta with blue shadows step back to glowing buttes under an
 * amber horizon and a clear blue sky, and a river winds up the canyon floor
 * mirroring the blue. Light drifts along the rims, the water shimmers and
 * thin clouds pass.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const CanyonRiver = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  dither = "none",
  square = true,
  stillTime = 0,
  intensity = 1,
  clouds = true,
  fallback = FALLBACK,
  // The canyon has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: CanyonRiverProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const resolved = resolveCharset(charset, chars);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        canyonCloudsOn: clouds ? 1 : 0,
        canyonIntensity: clamp(intensity, 0, 1),
        canyonPitch: resolved.id === "dots" && !square ? 2 : 1,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (DEEP_BLUE_MODES.has(mode) ? DEEP_BLUE : undefined)}
      cell={cell}
      dither={dither}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

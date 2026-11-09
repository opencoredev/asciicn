"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The forest is painted back to front in square units (x runs 0 to the
// box's aspect, y 0 to 1 up): haze and the sun, the fern floor, two rows of
// distant trunks with mist between them, the canopy, the light shafts and
// the motes in them, the near trunks, and fern fronds across the bottom.
// Every trunk leans towards one vanishing point high above the centre, so
// the forest reads as seen from the floor looking up. The colour of each
// sample becomes both the dot's colour and its size, so light areas draw
// big dots and the darkest shade still keeps a faint dot.
const SCENE = `
// The far edge of the floor, where the haze takes over.
const float RW_HORIZON = 0.31;
// Height of the point every trunk leans towards.
const float RW_VANISH = 3.4;

// Set once per sample by redwoodScene and read by every layer.
float rwT;
float rwAspect;
float rwCx;
float rwHalf;
float rwRow;
float rwCol;
vec2 rwSun;

// A stable random value. The engine's hash21 repeats on whole numbers,
// which would tile the trunk rows.
float rwHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// How much a trunk has narrowed at height y, 1 at the horizon.
float rwScale(float y) {
  return (RW_VANISH - y) / (RW_VANISH - RW_HORIZON);
}

// x in trunk space, where every trunk stands straight.
float rwU(vec2 p) {
  return rwCx + (p.x - rwCx) / rwScale(p.y);
}

// The air: blue-green haze, paler low down in the distance and deeper
// higher up. Sunlight scattered through the leaves lifts it to a soft
// green-gold towards the sun, so the forest is lit, not murky.
vec3 rwHaze(vec2 p) {
  float h = clamp((p.y - RW_HORIZON) / 0.62, 0.0, 1.0);
  vec3 col = mix(vec3(0.3, 0.44, 0.4), vec3(0.12, 0.22, 0.2), h);
  col *= 0.94 + 0.12 * fbm(vec2(p.x * 2.2, p.y * 1.4) + 21.0);
  vec2 g = (p - rwSun) * vec2(0.6, 0.85);
  col = mix(col, vec3(0.6, 0.66, 0.38), exp(-dot(g, g) * 4.0) * 0.6);
  float warm = exp(-length((p - rwSun) * vec2(0.7, 1.0)) * 5.0);
  return mix(col, vec3(0.92, 0.82, 0.52), warm * 0.6);
}

// The sun's halo: a hot core and a wide soft bloom.
float rwGlow(vec2 p) {
  // Smaller on narrow boxes, where the same halo would fill the width.
  float d = length((p - rwSun) * vec2(0.8, 1.0)) / mix(0.6, 1.0, smoothstep(0.6, 1.4, rwAspect));
  return 0.9 * exp(-d / 0.022) + 0.22 * exp(-d / 0.09);
}

// One shaft: a soft band across the light, brightest down its middle.
float rwBeam(float q, float at, float width) {
  float k = (q - at) / width;
  return exp(-k * k);
}

// Four shafts of light falling steeply from the opening in the canopy,
// upper right, slanting a little to the left and widening as they fall.
// Each breathes on its own slow cycle. They stay on the sun's side, so the
// middle of the box is calm air for a headline.
float rwShaft(vec2 p) {
  float drop = rwSun.y + 0.06 - p.y;
  if (drop < 0.0) {
    return 0.0;
  }
  float wide = smoothstep(0.6, 1.4, rwAspect);
  float slope = mix(0.08, 0.16, wide);
  // Position across the shafts, measured where they leave the canopy.
  float q = (p.x - rwSun.x + drop * slope) / (1.0 + 0.6 * drop);
  float unit = min(rwAspect, 1.0);
  float b = rwBeam(q, -0.17 * unit, 0.042 * unit) * (0.55 + 0.15 * sin(rwT * 0.19 + 1.0));
  b += rwBeam(q, -0.07 * unit, 0.03 * unit) * (0.8 + 0.2 * sin(rwT * 0.23 + 2.0));
  b += rwBeam(q, 0.03 * unit, 0.05 * unit) * (0.9 + 0.1 * sin(rwT * 0.16 + 4.0));
  b += rwBeam(q, 0.13 * unit, 0.03 * unit) * (0.65 + 0.2 * sin(rwT * 0.27 + 3.0));
  // Leaves between the sun and the air break each shaft into pieces, so
  // the light falls dappled, never as a clean bar.
  float dapple = fbm(vec2(q * 38.0, drop * 7.0) + vec2(3.0, -rwT * 0.008));
  b *= smoothstep(0.36, 0.6, dapple);
  // Brightest just under the canopy, thinning into the haze as they fall.
  // Even along their length, so no shaft reads as a bright bar that stops.
  // On narrow boxes they fall shorter, so they end above the headline.
  float reach = mix(0.4, 0.9, wide);
  return b * smoothstep(0.0, 0.35, drop) * mix(0.8, 0.5, smoothstep(0.2, 0.9, drop)) * (1.0 - smoothstep(reach * 0.6, reach, drop)) * mix(0.5, 1.0, wide);
}

// One layer of foliage: clumped masses above "bottom" that hang lower in
// places, with ragged leafy edges. Returns how much of the point is leaf,
// and how deep inside its mass it lies (0 at the fringe, 1 in the heart).
vec2 rwLeaves(vec2 p, float bottom, float scale, float seed) {
  float mass = fbm(p * scale + seed) + (p.y - bottom) * 2.4;
  mass += 0.08 * snoise(p * scale * 8.0 + seed) + 0.05 * snoise(p * scale * 17.0 - seed);
  return vec2(smoothstep(0.5, 0.52, mass), smoothstep(0.52, 0.74, mass));
}

// A foliage layer's colour: dark at the heart of each mass, its fringe
// lifted towards the haze, and gold where the sun backlights it.
vec3 rwLeafColor(vec2 p, vec2 leaf, vec3 heart, float sunD) {
  vec3 fringe = mix(heart, rwHaze(p), 0.45);
  vec3 col = mix(fringe, heart, leaf.y);
  // Sprays of leaves inside each mass catch more or less light.
  float spray = fbm(p * vec2(11.0, 14.0) + heart.g * 40.0);
  col *= mix(0.75, 1.3, smoothstep(0.3, 0.75, spray));
  float back = (1.0 - leaf.y) * exp(-sunD / 0.16);
  return mix(col, vec3(0.86, 0.78, 0.42), back * 0.75);
}

// One row of trunks. Trunk space is cut into slots, each holding at most
// one trunk; a trunk leans a little, so its neighbours' slots are checked
// too. Widths are skewed: many thin trunks and a few broad ones. Slots
// within "clear" of the middle stay empty, for the headline.
vec4 rwTrunks(vec2 p, float spacing, float wMin, float wMax, float base, float seed, float chance, vec3 bark, float clear) {
  float u = rwU(p);
  float id0 = floor(u / spacing);
  vec4 best = vec4(0.0);
  for (int i = -1; i <= 1; i++) {
    float id = id0 + float(i);
    if (rwHash(vec2(id, seed)) > chance) {
      continue;
    }
    float uc = (id + 0.2 + 0.6 * rwHash(vec2(id, seed + 1.0))) * spacing;
    if (abs(uc - rwCx) < clear) {
      continue;
    }
    float hw = mix(wMin, wMax, pow(rwHash(vec2(id, seed + 2.0)), 2.2));
    float b = base + 0.04 * (rwHash(vec2(id, seed + 3.0)) - 0.5) + 0.012 * snoise(vec2(p.x * 40.0, seed));
    if (p.y < b) {
      continue;
    }
    float h = p.y - b;
    // Every trunk has its own lean, a slight bow, and its own taper: some
    // narrow fast, some barely at all.
    float lean = (rwHash(vec2(id, seed + 4.0)) - 0.5) * 0.14;
    float bow = (rwHash(vec2(id, seed + 5.0)) - 0.5) * 0.05 * sin(h * 3.0);
    float taper = mix(0.5, 0.95, rwHash(vec2(id, seed + 6.0)));
    float w = hw * (1.0 + 0.4 * exp(-h / 0.04)) * mix(1.0, taper, smoothstep(b, 1.0, p.y));
    // The girth swells and narrows a little along the height.
    w *= 1.0 + 0.14 * snoise(vec2(p.y * 4.0, id * 1.7 + seed));
    float x = (u - uc - lean * h - bow) / w;
    // Bark noise breaks each edge on its own, so neither side is a ruled line.
    x += 0.12 * snoise(vec2(p.y * 7.0, id * 3.1 + seed));
    x += sign(x) * 0.16 * snoise(vec2(p.y * 19.0, id * 2.3 + seed + step(0.0, x) * 7.0));
    float soft = rwCol / (w * rwScale(p.y));
    float cover = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.5, abs(x));
    if (cover <= best.a) {
      continue;
    }
    float side = sign(rwSun.x - p.x);
    float lit = smoothstep(-0.5, 1.0, x * side);
    float furrow = snoise(vec2(x * 3.0 + id * 7.3, p.y * 2.0 + id));
    vec3 col = bark * mix(0.4, 1.5, lit) * (0.78 + 0.3 * furrow);
    // Patches of moss and shade up the trunk, so no trunk is one flat tone.
    col *= 0.78 + 0.4 * fbm(vec2(id * 3.7 + seed, p.y * 3.5));
    // A faint warm edge only: strong rims belong to the giants in front.
    col = mix(col, vec3(0.7, 0.52, 0.32), smoothstep(0.75, 0.98, x * side) * 0.22);
    best = vec4(col, cover);
  }
  return best;
}

// Ground mist drifting slowly between the far trunks.
float rwMist(vec2 p) {
  float band = smoothstep(0.2, 0.3, p.y) * (1.0 - smoothstep(0.38, 0.56, p.y));
  float n = fbm(vec2(p.x * 1.4 - rwT * 0.011, p.y * 5.0 + 3.0));
  return band * smoothstep(0.38, 0.72, n) * rwMistOn;
}

// The fern floor seen in perspective: clumps get smaller and hazier
// towards the horizon, and the shafts land on it as warm pools.
vec3 rwFloor(vec2 p, float shaft) {
  float dy = max(RW_HORIZON - p.y, 0.004);
  float z = 0.1 / dy;
  vec2 g = vec2((p.x - rwCx) * z * 3.2, z * 2.4);
  float clump = fbm(g * 0.9 + 5.0);
  float frond = 0.5 + 0.5 * snoise(g * vec2(3.6, 2.4) + 9.0);
  float leaf = smoothstep(0.35, 0.75, clump) * mix(0.6, 1.0, frond);
  vec3 shade = vec3(0.06, 0.12, 0.07);
  vec3 fern = vec3(0.24, 0.42, 0.17);
  vec3 col = mix(shade, fern, leaf);
  vec3 sunlit = vec3(0.86, 0.82, 0.36);
  col = mix(col, sunlit * mix(0.6, 1.0, leaf), clamp(shaft * 1.6, 0.0, 1.0) * mix(0.5, 0.95, leaf));
  float far = smoothstep(0.05, RW_HORIZON, p.y);
  return mix(col, rwHaze(vec2(p.x, RW_HORIZON)) * 0.85, far * far * 0.75);
}

// The giants in front: hand placed so the middle stays open for a
// headline, and narrowed on tall boxes so they never fill a phone.
vec4 rwGiant(vec2 p, float at, float hw, float base, float seed, float lean) {
  // A slight bow as well as the lean, so no trunk is a ruled line.
  float u = rwU(p) - lean * (p.y - base) - 0.012 * sin((p.y - base) * 2.6 + seed * 1.9);
  float uc = rwCx + at * rwHalf;
  if (p.y < base) {
    return vec4(0.0);
  }
  float w = hw * (1.0 + 0.55 * exp(-(p.y - base) / 0.07));
  // Each trunk tapers at its own rate and swells a little along its height.
  w *= mix(1.0, 0.72 + 0.12 * fract(seed * 0.37), smoothstep(base, 1.0, p.y));
  w *= 1.0 + 0.08 * snoise(vec2(p.y * 3.0, seed * 5.3));
  float x = (u - uc) / w;
  // A ragged outline: bark plates and buttresses break every edge, each
  // side on its own.
  x += 0.07 * snoise(vec2(p.y * 5.0, seed * 7.0));
  x += sign(x) * 0.07 * snoise(vec2(p.y * 21.0, seed * 3.0 + step(0.0, x) * 5.0));
  float soft = rwCol / (w * rwScale(p.y));
  float cover = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.5, abs(x));
  if (cover <= 0.0) {
    return vec4(0.0);
  }
  float side = sign(rwSun.x - uc);
  float facing = x * side;
  // Furrows of uneven width that wander, split and rejoin as they climb.
  float groove = snoise(vec2(x * 4.5 + seed * 5.0, p.y * 0.9 + seed));
  groove += 0.5 * snoise(vec2(x * 9.0 - seed, p.y * 2.3));
  float furrow = smoothstep(-0.5, 0.7, groove);
  float lit = smoothstep(-0.9, 1.0, facing);
  float rim = smoothstep(0.25, 1.0, facing) * mix(0.5, 1.0, furrow);
  vec3 bark = vec3(0.58, 0.26, 0.15);
  // Ridges catch the light and grooves stay in shade; the shadow side
  // sinks to a quiet dark brown.
  vec3 col = bark * mix(0.5, 1.05, furrow) * mix(0.45, 1.0, lit);
  col = mix(col, vec3(0.9, 0.58, 0.32), rim * rim * 0.45);
  return vec4(col, cover);
}

// Fern clumps across the bottom edge, in front of everything: each is a
// fan of arching fronds with saw-toothed leaflets, dark at the heart and
// lighter towards the tips, gold where a shaft reaches them.
vec4 rwFronds(vec2 p, float shaft) {
  if (p.y > 0.34) {
    return vec4(0.0);
  }
  float sp = 0.3;
  float id0 = floor(p.x / sp);
  float best = -1.0;
  vec3 col = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    float id = id0 + float(i);
    if (rwHash(vec2(id, 60.0)) > 0.85) {
      continue;
    }
    vec2 c = vec2((id + 0.5 + 0.5 * (rwHash(vec2(id, 61.0)) - 0.5)) * sp, -0.04);
    float len = mix(0.22, 0.32, rwHash(vec2(id, 62.0)));
    vec2 d = p - c;
    for (int j = 0; j < 5; j++) {
      float fj = float(j) - 2.0;
      float a = fj * 0.5 + 0.3 * (rwHash(vec2(id, 70.0 + float(j))) - 0.5);
      float l = len * (1.0 - 0.16 * abs(fj));
      float ca = cos(a);
      float sa = sin(a);
      float t = (d.x * sa + d.y * ca) / l;
      if (t < 0.0 || t > 1.0) {
        continue;
      }
      // The spine arches outward and down as it grows.
      float bend = a >= 0.0 ? 1.0 : -1.0;
      float off = (d.x * ca - d.y * sa) - bend * 0.5 * l * t * t;
      float w = l * 0.17 * sin(3.1416 * pow(t, 0.7));
      float saw = fract(t * l / 0.022 + rwHash(vec2(id, float(j))));
      if (abs(off) > w * (0.62 + 0.38 * (1.0 - saw))) {
        continue;
      }
      // The front frond of the clump wins, so overlapping ones stay clear.
      float order = 1.0 - abs(fj) * 0.2 + float(i) * 0.01;
      if (order <= best) {
        continue;
      }
      best = order;
      float v = mix(0.45, 1.0, t) * mix(0.7, 1.0, smoothstep(0.0, 0.4, abs(off) / max(w, 0.001)));
      col = mix(vec3(0.08, 0.17, 0.08), vec3(0.36, 0.56, 0.2), v);
      // A paler midrib down each frond.
      col = mix(col, vec3(0.5, 0.64, 0.3), (1.0 - smoothstep(0.0, 0.18, abs(off) / max(w, 0.001))) * 0.5);
      col = mix(col, vec3(0.84, 0.8, 0.36), clamp(shaft * 1.2, 0.0, 1.0) * t * 0.8);
    }
  }
  return vec4(col, best > -1.0 ? 1.0 : 0.0);
}

// Dust and pollen drifting slowly, seen only where a shaft lights them.
float rwMotes(vec2 p) {
  float sp = 0.055;
  vec2 q = p + vec2(rwT * 0.0045, -rwT * 0.0028);
  q.x += 0.008 * sin(rwT * 0.13 + p.y * 9.0);
  vec2 id = floor(q / sp);
  vec2 f = q - id * sp;
  float h = rwHash(id + u_seed + 31.0);
  if (h > 0.4) {
    return 0.0;
  }
  vec2 c = sp * (0.2 + 0.6 * vec2(rwHash(id + 5.0), rwHash(id + 9.0)));
  vec2 d = (f - c) / vec2(rwCol * 1.2, rwRow * 0.9);
  float twinkle = 0.65 + 0.35 * sin(rwT * (0.5 + h) + h * 40.0);
  return exp(-dot(d, d)) * twinkle * rwMotesOn;
}

// 1 across the headline band (the middle half of the width, 30 to 65% of
// the height), fading out softly around it.
float rwCalm(vec2 uv) {
  float cx = 1.0 - smoothstep(0.16, 0.36, abs(uv.x - 0.5));
  float cy = smoothstep(0.18, 0.36, uv.y) * (1.0 - smoothstep(0.55, 0.82, uv.y));
  return cx * cy;
}

vec2 rwCacheUv = vec2(-1.0);
float rwCacheT = -1.0;
vec4 rwCacheValue = vec4(0.0);

vec4 redwoodScene(vec2 uv, vec2 res, float t) {
  if (uv == rwCacheUv && t == rwCacheT) {
    return rwCacheValue;
  }
  rwT = t;
  rwAspect = res.x / res.y;
  rwCx = rwAspect * 0.5;
  rwHalf = rwCx;
  rwRow = 1.0 / res.y;
  rwCol = rwAspect / max(ascii_samples.x, 1.0);
  // The sun and the opening in the canopy sit upper right on every box,
  // so the middle stays calm for a headline.
  rwSun = vec2(rwAspect * mix(0.64, 0.73, smoothstep(0.6, 1.4, rwAspect)), 0.86);
  vec2 p = vec2(uv.x * rwAspect, uv.y);

  float shaft = rwShaft(p);
  vec3 col;
  if (p.y >= RW_HORIZON) {
    col = rwHaze(p);
  } else {
    col = rwFloor(p, shaft);
  }

  float calm = rwCalm(uv);
  float sunD = length((p - rwSun) * vec2(0.85, 1.0));
  // 0 in the middle of the box, 1 at its sides, where foliage hangs lower.
  float sides = smoothstep(0.18, 0.5, abs(uv.x - 0.5));

  // Many thin far trunks, nearly lost in the haze, then a sparser row.
  vec4 t1 = rwTrunks(p, 0.05, 0.004, 0.012, 0.31, 17.0, 0.75, vec3(0.15, 0.21, 0.21), 0.0);
  col = mix(col, mix(t1.rgb, rwHaze(p), 0.4 + 0.3 * calm), t1.a);
  vec4 t2 = rwTrunks(p, 0.1, 0.006, 0.02, 0.29, 23.0, 0.7, vec3(0.22, 0.22, 0.21), 0.0);
  col = mix(col, mix(t2.rgb, rwHaze(p), 0.36 + 0.3 * calm), t2.a);

  // Soft sprays of far foliage and patches of high mist hide parts of the
  // far trunks, so they never run unbroken from floor to canopy.
  vec2 lu = rwLeaves(p, 0.6 + 0.2 * (1.0 - sides), 4.6, 41.0);
  col = mix(col, mix(vec3(0.12, 0.2, 0.15), rwHaze(p), 0.6), lu.x * 0.85);
  float veil = fbm(vec2(p.x * 2.6 - rwT * 0.008, p.y * 3.2 + 11.0));
  veil = smoothstep(0.48, 0.7, veil) * smoothstep(0.33, 0.45, p.y) * (1.0 - smoothstep(0.62, 0.8, p.y));
  col = mix(col, rwHaze(p) * 1.08, veil * 0.75 * rwMistOn);

  // The far canopy, pale with haze, open only right around the sun.
  vec2 lf = rwLeaves(p, 0.8, 3.2, 3.0);
  lf.x *= 1.0 - 0.9 * exp(-pow(sunD / 0.08, 2.0));
  col = mix(col, rwLeafColor(p, lf, mix(vec3(0.1, 0.18, 0.15), rwHaze(p), 0.45), sunD), lf.x);

  float mist = rwMist(p);
  col = mix(col, rwHaze(p) * 1.15 + vec3(0.1, 0.08, 0.03) * shaft, mist * 0.6);
  // The middle row: trunks of every width from thin to broad.
  vec4 t3 = rwTrunks(p, 0.2, 0.014, 0.045, 0.25, 29.0, 0.75, vec3(0.32, 0.16, 0.1), 0.16 * rwAspect);
  col = mix(col, mix(t3.rgb, rwHaze(p), 0.14), t3.a);
  col = mix(col, rwHaze(p) * 1.1, mist * 0.18 * (1.0 - t3.a * 0.5));
  // The sun shines past the trunks and behind the canopy, so the leaves
  // in front break it up.
  col += vec3(1.0, 0.84, 0.55) * rwGlow(p);

  // The middle canopy, overlapping the far one, with a wider opening.
  vec2 lm = rwLeaves(p, 0.9 - 0.12 * sides, 2.3, 9.0);
  lm.x *= 1.0 - exp(-pow(sunD / 0.14, 2.0));
  col = mix(col, rwLeafColor(p, lm, vec3(0.08, 0.16, 0.1), sunD), lm.x);
  float canopy = max(lf.x * 0.6, lm.x);

  // Shafts scatter warm light into the air under the canopy.
  float air = shaft * (1.0 - 0.8 * canopy) * smoothstep(RW_HORIZON - 0.1, RW_HORIZON + 0.08, p.y);
  // The middle of the box, where a headline sits, stays calm air.
  air *= 1.0 - 0.8 * calm;
  col += vec3(0.82, 0.62, 0.28) * air * 1.1;
  float mote = rwMotes(p) * (0.15 + shaft * 1.2) * (1.0 - canopy) * (1.0 - 0.7 * calm) * step(RW_HORIZON, p.y);
  col = mix(col, vec3(1.0, 0.95, 0.78), clamp(mote, 0.0, 1.0));

  // A soft vignette: the light lives in the middle and the sun's side.
  vec2 v = (p - vec2(mix(rwCx, rwSun.x, 0.4), 0.55)) / vec2(max(rwCx, 0.4) * 1.25, 0.8);
  col *= mix(1.0, 0.8, smoothstep(0.35, 1.15, length(v)));

  // The giants in front, rim lit on the sun's side.
  float squeeze = mix(0.4, 1.0, smoothstep(0.5, 1.4, rwAspect));
  // Two huge trunks frame the view; medium ones stand a little behind,
  // each at its own lean, the farther ones softened by the haze.
  vec4 g = rwGiant(p, -0.84, 0.14 * squeeze, -0.02, 1.0, 0.03);
  vec4 g2 = rwGiant(p, -0.47, 0.065 * squeeze, 0.08, 2.0, -0.025);
  vec4 g3 = rwGiant(p, 0.82, 0.16 * squeeze, -0.04, 3.0, -0.02);
  vec4 g4 = rwGiant(p, 0.6, 0.045 * squeeze, 0.12, 4.0, 0.035);
  vec4 g5 = rwGiant(p, -0.64, 0.032 * squeeze, 0.14, 5.0, -0.04);
  g2.rgb = mix(g2.rgb, rwHaze(p), 0.18);
  g4.rgb = mix(g4.rgb, rwHaze(p), 0.3);
  g5.rgb = mix(g5.rgb, rwHaze(p), 0.34);
  // On narrow boxes the medium trunks would merge into the giants.
  float roomy = smoothstep(0.75, 1.05, rwAspect);
  g2.a *= roomy;
  g4.a *= roomy;
  g5.a *= roomy;
  // Mist drifts across the farther medium trunks and hides parts of them.
  float drift = smoothstep(0.5, 0.72, fbm(vec2(p.x * 3.0 + rwT * 0.006, p.y * 2.4 + 4.0))) * rwMistOn;
  g4.a *= 1.0 - 0.65 * drift;
  g5.a *= 1.0 - 0.65 * drift;
  col = mix(col, g5.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.5, g5.a);
  col = mix(col, g4.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.5, g4.a);
  col = mix(col, g2.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.5, g2.a);
  col = mix(col, g.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.35, g.a);
  col = mix(col, g3.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.35, g3.a);

  // The near canopy, darkest, hanging low in sprays at the sides so it
  // overlaps the giants and frames the light.
  vec2 ln = rwLeaves(p, 0.98 - 0.32 * sides, 1.6, 17.0);
  ln.x *= 1.0 - exp(-pow(sunD / 0.24, 2.0));
  // Small gaps let the sky through the near leaves, and the leaves near
  // the top catch light from above, so the corners are never black.
  float gaps = smoothstep(0.52, 0.61, fbm(p * vec2(13.0, 16.0) + 5.0)) * smoothstep(0.68, 0.88, p.y);
  ln.x *= 1.0 - 0.75 * gaps;
  vec3 nearHeart = mix(vec3(0.06, 0.13, 0.08), vec3(0.12, 0.2, 0.1), smoothstep(0.72, 1.0, p.y));
  col = mix(col, rwLeafColor(p, ln, nearHeart, sunD), ln.x);
  col += vec3(0.3, 0.33, 0.17) * gaps * (1.0 - ln.x) * sides;

  vec4 fronds = rwFronds(p, shaft);
  col = mix(col, fronds.rgb, fronds.a);

  col = clamp(col, 0.0, 1.0);
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  // Dot size follows brightness. The faintest dot starts near tone 0.09,
  // the middle one near 0.32 and the largest near 0.73. Shadow gets the
  // smallest dot or none, the haze small dots, and only the light, its
  // pools and the lit edges reach the large ones.
  float tone = 0.13 * smoothstep(0.02, 0.06, lum) + 0.87 * smoothstep(0.06, 0.8, lum);
  // Small dots in shadow sit close to the paper: darker and greyer, so
  // the shade reads as quiet air rather than a field of dots.
  float quiet = smoothstep(0.03, 0.18, lum);
  vec3 ink = mix(vec3(lum) * 1.3 + vec3(0.01, 0.02, 0.015), col * 1.15, quiet);
  tone *= mix(0.35, 1.0, sqrt(rwIntensity));
  rwCacheUv = uv;
  rwCacheT = t;
  rwCacheValue = vec4(ink * rwIntensity, rwIntensity > 0.0 ? tone : 0.0);
  return rwCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return redwoodScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return redwoodScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need the forest's shade behind
// them in both themes; mono and palette keep the theme's paper, or the phosphor's.
const SHADE = "#060a08";
const SHADE_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 65% 8%, #6b6a4a 0%, #24362f 35%, #0c1512 70%, #060a08 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RedwoodLightProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Dust and pollen drifting through the light shafts. Default `true`. */
  motes?: boolean;
  /** Mist drifting between the far trunks. Default `true`. */
  mist?: boolean;
  /**
   * Paper behind the glyphs. Default: the forest's deep shade in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the shade. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: a soft gradient of the scene. */
  fallback?: ReactNode;
  /** Ignored: the forest never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A redwood forest in early morning. Huge trunks rise in perspective, the
 * nearest dark and furrowed, the farther ones fading into blue-green haze,
 * while shafts of golden light slant through the canopy onto a fern floor
 * and motes drift in the light. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const RedwoodLight = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 12,
  intensity = 1,
  motes = true,
  mist = true,
  fallback = FALLBACK,
  // The forest has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: RedwoodLightProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rwIntensity: clamp(intensity, 0, 1),
        rwMistOn: mist ? 1 : 0,
        rwMotesOn: motes ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (SHADE_MODES.has(mode) ? SHADE : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

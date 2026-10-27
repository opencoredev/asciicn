"use client";

import type { ReactNode } from "react";

import { useAsciiColors } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Ocean Drive seen from the surf, looking west at dusk. Everything is laid
// out in box-height units (y runs 0 at the bottom to 1 at the top, x is
// centred and scaled by the true aspect), so a portrait box shows fewer
// hotels instead of squashed ones. Layers from back to front: sky and sun,
// the hotel row, palms, the drive, the beach, the water. Each layer returns
// its own colour and tone, so the tone is designed for glyphs rather than
// derived from brightness: open sky stays empty and the neon is densest.
// `miScene` is cached per sample because field and colorField both ask.
const SCENE = `
const float MI_BASE = 0.32;
const float MI_LOT = 0.3;
const float MI_SUN_X = 0.12;
const float MI_SUN_Y = 0.53;
const float MI_SUN_R = 0.085;
// Roughly where the roofs end; the dusk glow is measured up from here.
const float MI_ROOF = 0.45;

const vec3 miPink = vec3(1.0, 0.24, 0.62);
const vec3 miTeal = vec3(0.1, 0.95, 0.88);

float miShore(float x, float t) {
  return 0.15 + 0.006 * sin(x * 6.0 + 1.3) + 0.004 * snoise(vec2(x * 3.0, 0.7))
    + 0.007 * sin(t * 0.45 + x * 1.7) * miSway;
}

// Distance from p to the segment ab, and how far along it p falls.
vec2 miSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return vec2(length(p - a - ab * h), h);
}

vec4 miSky(vec2 p, float t, float pixel) {
  float h = clamp((p.y - MI_ROOF) / (1.0 - MI_ROOF), 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.36, 0.58), smoothstep(0.0, 0.25, h));
  col = mix(col, vec3(0.62, 0.3, 0.9), smoothstep(0.2, 0.55, h));
  col = mix(col, vec3(0.3, 0.18, 0.62), smoothstep(0.5, 0.95, h));
  // The glow above the roofs gets glyphs, thinning into haze lines as it
  // climbs; the top of the sky is open.
  float haze = 0.75 + 0.5 * fbm(vec2(p.x * 2.0 + t * 0.01, p.y * 26.0));
  float tone = 0.11 * (1.0 - smoothstep(0.0, 0.45, h)) * haze;

  // Long thin clouds, lit pink from below by the sun.
  float band = smoothstep(0.2, 0.32, h) * (1.0 - smoothstep(0.55, 0.75, h));
  float streak = fbm(vec2(p.x * 1.4 + t * 0.012, p.y * 11.0));
  float cloud = smoothstep(0.56, 0.7, streak) * band;
  float under = smoothstep(0.6, 0.75, fbm(vec2(p.x * 1.4 + t * 0.012, (p.y - pixel * 1.5) * 11.0)));
  vec3 cloudCol = mix(vec3(0.7, 0.35, 0.8), vec3(1.0, 0.62, 0.55), under);
  col = mix(col, cloudCol, cloud);
  tone = max(tone, cloud * (0.2 + 0.12 * under));

  // A few early stars at the top, twinkling.
  vec2 g = p * vec2(34.0, 34.0);
  vec2 id = floor(g);
  float star = hash21(id + 17.0);
  if (star > 0.965 && h > 0.62) {
    float d = length(fract(g) - 0.5);
    float twinkle = 0.55 + 0.45 * sin(t * (1.5 + star * 3.0) + star * 40.0);
    float s = smoothstep(0.32, 0.0, d) * twinkle * smoothstep(0.62, 0.85, h);
    col = mix(col, vec3(1.0, 0.92, 1.0), s);
    tone = max(tone, s * 0.75);
  }

  // The low sun: a warm disc with a halo, sliced by thin cloud lines.
  vec2 s = p - vec2(MI_SUN_X, MI_SUN_Y);
  float r = length(s);
  float disc = 1.0 - smoothstep(MI_SUN_R - pixel, MI_SUN_R + pixel, r);
  float slice = step(0.82, fract((s.y + MI_SUN_R) * 34.0 + t * 0.05)) * step(s.y, -0.012);
  disc *= 1.0 - slice;
  vec3 sunCol = mix(vec3(1.0, 0.38, 0.45), vec3(1.0, 0.85, 0.5), smoothstep(-MI_SUN_R, MI_SUN_R, s.y));
  float halo = exp(-max(r - MI_SUN_R, 0.0) * 18.0) * (1.0 - disc);
  col = mix(col, sunCol, disc);
  col = mix(col, vec3(1.0, 0.5, 0.55), halo * 0.6);
  tone = max(tone, max(disc * 0.95, halo * 0.26));
  return vec4(col, tone);
}

// Signed distance to a box standing on y = 0, rounded at the corners.
float miBox(vec2 p, float halfW, float height, float radius) {
  vec2 q = abs(vec2(p.x, p.y - height * 0.5)) - vec2(halfW, height * 0.5) + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// One art deco hotel per lot: a rounded body, stepped setbacks on the roof,
// a vertical neon fin with a sign, a neon roofline and rows of windows with
// eyebrow ledges. Returns vec4(0) where the lot is open sky.
vec4 miHotel(vec2 p, float t, float pixel) {
  float lot = (p.x - MI_SUN_X) / MI_LOT + 0.5;
  float id = floor(lot);
  float u = fract(lot) - 0.5;
  float r1 = hash21(vec2(id, 3.1));
  float r2 = hash21(vec2(id, 7.7));
  float r3 = hash21(vec2(id, 12.9));
  // The lot in front of the sun holds a low pavilion so the sun shows.
  bool low = abs(id) < 0.5;
  float halfW = (0.3 + r2 * 0.1) * MI_LOT;
  float height = low ? 0.045 : 0.12 + r1 * 0.16;
  float x = u * MI_LOT;
  float y = p.y - MI_BASE;

  // Stepped crown: up to three setbacks, each narrower and a sample row or
  // more higher. The silhouette is the union of rounded boxes, so the neon
  // tube traces the outline and not the inner edges of each setback.
  float steps = low ? 0.0 : floor(1.0 + r3 * 2.99);
  float stepH = max(0.022, pixel * 1.2);
  float radius = min(0.022, halfW * 0.3);
  float body = miBox(vec2(x, y), halfW, height, radius);
  float top = height;
  float stepHalf = halfW;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= steps) {
      break;
    }
    float w = halfW * (0.66 - float(i) * 0.2);
    float h = height + float(i + 1) * stepH;
    body = min(body, miBox(vec2(x, y), w, h, min(radius, w * 0.4)));
    if (abs(x) < w) {
      top = h;
      stepHalf = w;
    }
  }

  // The fin rises through the middle of the roof, a sign above it.
  float finW = max(0.008, pixel * 0.6);
  float finTop = top + (low ? 0.0 : max(0.05, pixel * 2.5) + r2 * 0.06);
  float fin = (!low && abs(x) < finW && y < finTop && y > height * 0.45) ? 1.0 : 0.0;

  vec3 pastel = r1 < 0.25 ? vec3(1.0, 0.72, 0.82)
    : r1 < 0.5 ? vec3(0.62, 1.0, 0.86)
    : r1 < 0.75 ? vec3(1.0, 0.9, 0.62)
    : vec3(0.78, 0.72, 1.0);
  vec3 neon = r2 > 0.5 ? miPink : miTeal;
  vec3 neon2 = r2 > 0.5 ? miTeal : miPink;
  // Most signs hum steadily; a few stutter.
  float buzz = 1.0 - step(0.9, hash21(vec2(id, floor(t * 9.0)))) * step(0.55, r3) * 0.85;
  float lit = buzz * miNeon;

  if (fin > 0.5) {
    // Stacked segments down the fin, like letters on a blade sign, that
    // light from the top one at a time and then hold.
    // Each segment is two sample rows: a lit row and a dark gap.
    float segH = max(0.024, pixel * 2.0);
    float seg = floor((finTop - y) / segH);
    float gap = step(0.5, fract((finTop - y) / segH));
    float count = 1.0 + floor((finTop - height * 0.45) / segH);
    float chase = mod(t * 2.2 + r3 * 9.0, count + 6.0);
    float on = step(seg, chase);
    float tone = mix(0.2, 1.0, on * (1.0 - gap) * lit);
    return vec4(mix(neon * 0.35, neon, on * lit), tone);
  }
  if (body > pixel * 0.5) {
    // Just outside the roofline: the neon tube's glow.
    float glow = exp(-body / max(pixel * 1.4, 0.006)) * lit * step(height * 0.8, y);
    return glow > 0.08 ? vec4(neon, glow * 0.55) : vec4(0.0);
  }

  // The facade: solid pastel at dusk, a little brighter toward the street
  // lights, so each hotel reads as a block against the thinner sky glow.
  float uplight = 1.0 - smoothstep(0.0, height, y) * 0.4;
  float edge = smoothstep(y < height ? halfW : stepHalf, (y < height ? halfW : stepHalf) - 0.02, abs(x));
  vec3 col = pastel * mix(0.7, 1.0, uplight) * mix(0.8, 1.0, edge);
  float tone = 0.34 + 0.06 * uplight;

  // A neon tube traces the roofline and the setbacks and turns down the
  // upper corners. Columns are narrower than rows, so the sides get a
  // thinner tube than the roof.
  float roof = step(top - pixel * 1.2, y);
  float rim = step(-body, max(pixel * mix(0.45, 0.9, roof), 0.005)) * step(height * 0.55, y);
  if (rim > 0.0) {
    return vec4(mix(col, neon, rim * lit), mix(tone, 1.0, rim * lit));
  }

  // A horizontal sign band under the roof on wide hotels: lettered blocks
  // that wipe on from the left, hold, and go dark together.
  float bandY = height - max(0.035, pixel * 1.5);
  if (!low && abs(y - bandY) < max(0.009, pixel * 0.5) && abs(x) < halfW * 0.62) {
    float letter = floor((x + halfW) / 0.014);
    float ink = step(0.3, hash21(vec2(id, letter))) * step(0.2, fract((x + halfW) / 0.014));
    float wipe = mod(t * 0.5 + r1 * 5.0, 3.0);
    float on = step((x + halfW) / (halfW * 2.0), wipe) * step(wipe, 2.6);
    float l = ink * on * lit;
    return vec4(mix(col * 0.5, neon2, l), mix(0.2, 0.95, l));
  }

  // Rows of windows cut into the facade as dark holes, a few lit warm,
  // each floor capped by an eyebrow ledge that wraps the corner.
  float floorH = max(0.05, pixel * 3.0);
  float fy = (y - 0.02) / floorH;
  float row = floor(fy);
  float inRow = fract(fy);
  if (y > 0.02 && y < bandY - pixel && !low) {
    if (inRow > 0.7) {
      return vec4(mix(pastel, vec3(1.0), 0.35), 0.5);
    }
    float colW = max(0.04, pixel * 2.4);
    float wx = fract(x / colW + 0.5);
    if (inRow > 0.1 && inRow < 0.6 && wx > 0.25 && wx < 0.75 && edge > 0.5) {
      float cell = floor(x / colW + 0.5);
      float on = step(0.7, hash21(vec2(cell + id * 31.0, row + floor(t * 0.03 + r2 * 4.0) * 7.0)));
      vec3 warm = mix(vec3(1.0, 0.78, 0.5), vec3(0.75, 0.9, 1.0), step(0.8, hash21(vec2(cell, row + id))));
      // A dark window is a hole, but not open sky: a tone too small to draw.
      return on > 0.5 ? vec4(warm, 0.6) : vec4(col * 0.3, 0.001);
    }
  }
  // The pavilion's door glows; otherwise plain facade.
  if (low && abs(x) < 0.02 && y < 0.03) {
    return vec4(vec3(1.0, 0.8, 0.55), 0.6);
  }
  return vec4(col, tone);
}

// A palm: a curved, ringed trunk and a crown of drooping fronds that sway.
// Checks this palm slot and its neighbours, since crowns overlap.
vec4 miPalms(vec2 p, float t, float pixel) {
  float spacing = 0.36;
  float slot = floor(p.x / spacing);
  vec4 best = vec4(0.0);
  for (int k = -1; k <= 1; k++) {
    float id = slot + float(k);
    float r = hash21(vec2(id, 41.0));
    float r2 = hash21(vec2(id, 59.0));
    float baseX = (id + 0.5 + (r - 0.5) * 0.5) * spacing;
    float baseY = 0.24 + r2 * 0.03;
    float height = 0.36 + r * 0.22;
    float lean = (r2 - 0.5) * 0.14;
    float wind = sin(t * 0.7 + id * 1.9) * 0.012 * miSway;
    // Keep the sun clear.
    if (abs(baseX - MI_SUN_X) < 0.16) {
      continue;
    }

    // Trunk: x offset grows with the square of height, so it bends.
    float s = (p.y - baseY) / height;
    if (s > 0.0 && s < 1.0) {
      float cx = baseX + (lean + wind) * s * s;
      float w = mix(0.0105, 0.0065, s);
      w = max(w, pixel * 0.9);
      float d = abs(p.x - cx);
      if (d < w) {
        float ring = step(0.5, fract(s * height / max(pixel * 2.0, 0.018)));
        float side = 1.0 - d / w;
        vec3 col = mix(vec3(0.3, 0.18, 0.32), vec3(0.85, 0.5, 0.6), side * 0.6);
        best = vec4(col, 0.34 + 0.18 * ring * side);
      }
    }

    // The crown sits on the bent tip of the trunk.
    vec2 crown = vec2(baseX + lean + wind, baseY + height);
    if (abs(p.x - crown.x) < 0.28 && abs(p.y - crown.y) < 0.2) {
      for (int f = 0; f < 7; f++) {
        float ff = float(f);
        float rf = hash21(vec2(id, ff + 3.0));
        // Fronds leave the crown upward and arch over, like a fountain.
        float ang = mix(0.15, 2.99, ff / 6.0) + (rf - 0.5) * 0.3
          + sin(t * 0.9 + id * 2.3 + ff * 0.7) * 0.07 * miSway;
        float len = 0.16 + rf * 0.06;
        float droop = 0.14 + 0.05 * rf;
        vec2 dir = vec2(cos(ang), sin(ang) * 0.7);
        vec2 prev = crown;
        for (int j = 1; j <= 6; j++) {
          float q = float(j) / 6.0;
          vec2 next = crown + dir * len * q - vec2(0.0, droop * q * q);
          vec2 seg = miSegment(p, prev, next);
          float along = (float(j - 1) + seg.y) / 6.0;
          // Wide near the middle, pointed at the tip, never under a sample.
          float w = max(0.01 * sin(3.14159 * min(along * 1.1 + 0.08, 1.0)), pixel * 0.7);
          if (seg.x < w) {
            // Leaflets: the frond is combed into short strokes.
            float comb = step(0.3, fract(along * 14.0 + seg.x * 40.0));
            float top = clamp(0.5 + (p.y - mix(prev.y, next.y, seg.y)) / (w * 2.0), 0.0, 1.0);
            vec3 col = mix(vec3(0.12, 0.62, 0.5), vec3(1.0, 0.5, 0.68), top * 0.6);
            best = vec4(col, mix(0.3, 0.6, comb));
          }
          prev = next;
        }
      }
      // A dark knot where the fronds meet.
      if (length((p - crown) * vec2(1.0, 1.4)) < 0.012) {
        best = vec4(0.35, 0.2, 0.3, 0.72);
      }
    }
  }
  return best;
}

// Two lanes of traffic along the drive: classic cars with headlights
// throwing a beam ahead and red tail lights. Returns vec4(0) on open road.
// Sizes are in units of one sample row, at least, so a car is always a
// whole row of body under a row of cabin.
vec4 miCar(vec2 p, float t, float lane, float span, float pixel) {
  float dir = lane < 0.5 ? 1.0 : -1.0;
  float y0 = lane < 0.5 ? 0.272 : 0.236;
  float speed = lane < 0.5 ? 0.11 : 0.14;
  float unit = max(0.012, pixel) * (lane < 0.5 ? 0.9 : 1.0);
  vec4 hit = vec4(0.0);
  for (int k = 0; k < 3; k++) {
    float slot = float(k);
    float phase = t * speed / span + slot / 3.0 + lane * 0.17;
    float cycle = floor(phase);
    if (hash21(vec2(cycle * 3.0 + slot, lane + 5.0)) > miTraffic) {
      continue;
    }
    float cx = (fract(phase) - 0.5) * span * dir;
    vec2 d = vec2((p.x - cx) * dir, p.y - y0) / unit;
    if (d.y < 0.0 || d.y > 2.0) {
      // Only the beam reaches outside the car's two rows.
      continue;
    }
    float paint = hash21(vec2(cycle, slot + lane * 9.0));
    vec3 col = paint < 0.33 ? vec3(0.4, 0.95, 0.95)
      : paint < 0.66 ? vec3(1.0, 0.55, 0.75)
      : vec3(1.0, 0.95, 0.85);
    bool bodyRow = d.y < 1.0;
    if (bodyRow && d.x > 2.4 && d.x < 3.0) {
      return vec4(1.0, 0.97, 0.85, 1.0);
    }
    if (bodyRow && d.x < -2.4 && d.x > -3.0) {
      return vec4(1.0, 0.15, 0.2, 0.9);
    }
    if (bodyRow && abs(d.x) < 2.4) {
      hit = vec4(col * 0.8, 0.5);
    } else if (!bodyRow && abs(d.x + 0.3) < 1.4) {
      // A low cabin set back from the nose.
      hit = vec4(col * 0.5, 0.3);
    } else if (bodyRow && d.x > 3.0 && d.x < 9.0) {
      // The beam fades ahead of the car.
      float beam = 1.0 - (d.x - 3.0) / 6.0;
      if (hit.a < beam * 0.4) {
        hit = vec4(1.0, 0.92, 0.7, beam * 0.4);
      }
    }
  }
  return hit;
}

vec4 miStreet(vec2 p, float t, float pixel, float span) {
  // The curb in front of the hotels, then the asphalt.
  if (abs(p.y - (MI_BASE - 0.004)) < max(pixel * 0.6, 0.003)) {
    return vec4(0.9, 0.6, 0.75, 0.28);
  }
  vec4 car = miCar(p, t, 0.0, span, pixel);
  vec4 near = miCar(p, t, 1.0, span, pixel);
  if (near.a > 0.0 && near.a >= car.a) {
    car = near;
  }
  if (car.a > 0.0) {
    return car;
  }
  // Dashes down the middle of the road.
  if (abs(p.y - 0.262) < max(pixel * 0.5, 0.0025) && fract(p.x * 14.0) < 0.45) {
    return vec4(1.0, 0.85, 0.5, 0.2);
  }
  return vec4(0.0);
}

// The beach between the drive and the water, with a lifeguard stand.
vec4 miBeach(vec2 p, float t, float pixel) {
  vec2 g = floor(p * vec2(90.0, 120.0));
  float grain = step(0.86, hash21(g)) * 0.16;
  vec4 col = vec4(vec3(1.0, 0.72, 0.58) * 0.7, grain);
  // The stand: a pastel hut on stilts with a striped roof, left of centre.
  vec2 s = p - vec2(-0.52, 0.17);
  if (abs(s.x) < 0.04 && s.y > 0.03 && s.y < 0.058) {
    float stripe = step(0.5, fract(s.x * 50.0));
    return vec4(mix(vec3(0.3, 0.95, 0.9), vec3(1.0, 0.55, 0.75), stripe), 0.6);
  }
  if (abs(s.x) < 0.032 && s.y > 0.058 && s.y < 0.07 - abs(s.x) * 0.3) {
    return vec4(1.0, 0.4, 0.6, 0.7);
  }
  if ((abs(s.x - 0.024) < pixel * 0.9 || abs(s.x + 0.024) < pixel * 0.9) && s.y > 0.0 && s.y < 0.03) {
    return vec4(0.9, 0.8, 0.8, 0.45);
  }
  return col;
}

// Surf rolling toward the shore under the sky's colours, with the sun's
// glitter path running down to the viewer.
vec4 miWater(vec2 p, float t, float pixel, float shore) {
  float dd = max(shore - p.y, 0.0);
  // Crests bunch up toward the shore, which is further away.
  float phase = sqrt(dd) * 16.0 + t * 0.32;
  float wob = 0.12 * snoise(vec2(p.x * 3.0, floor(phase) * 1.7)) + 0.1 * snoise(vec2(p.x * 9.0, t * 0.1));
  float crest = 1.0 - abs(fract(phase + wob) - 0.5) * 2.0;
  float width = mix(0.86, 0.94, smoothstep(0.0, 0.12, dd));
  float broken = smoothstep(0.35, 0.6, fbm(vec2(p.x * 4.0 - floor(phase) * 3.3, floor(phase))));
  float foam = smoothstep(width, 1.0, crest) * broken;

  vec3 sea = mix(vec3(0.6, 0.3, 0.75), vec3(0.18, 0.12, 0.42), smoothstep(0.0, 0.14, dd));
  float tone = 0.1 + 0.06 * smoothstep(0.75, 1.0, crest);
  vec3 col = sea;

  // The swash: a lacy line of foam where each wave runs up the sand.
  float lace = exp(-dd / max(pixel * 1.6, 0.006)) * smoothstep(0.3, 0.6, fbm(vec2(p.x * 6.0, t * 0.2)));
  foam = max(foam, lace);
  col = mix(col, vec3(0.98, 0.95, 1.0), foam);
  tone = max(tone, foam * 0.78);

  // Glitter under the sun: broken bright cells, wider toward the viewer.
  float pathW = 0.025 + dd * 0.5;
  float inPath = 1.0 - smoothstep(pathW * 0.6, pathW, abs(p.x - MI_SUN_X));
  vec2 cell = floor(vec2(p.x * 60.0, phase * 6.0));
  float spark = step(0.55, hash21(cell + floor(t * 3.0) * 0.37)) * inPath;
  col = mix(col, vec3(1.0, 0.7, 0.45), spark);
  tone = max(tone, spark * mix(1.0, 0.65, smoothstep(0.0, 0.15, dd)));
  return vec4(col, tone);
}

vec2 miCacheUv = vec2(-1.0);
float miCacheT = -1.0;
vec4 miCacheValue = vec4(0.0);

vec4 miScene(vec2 uv, vec2 res, float t) {
  if (uv == miCacheUv && t == miCacheT) {
    return miCacheValue;
  }
  float aspect = res.x / res.y;
  vec2 base = vec2((uv.x - 0.5) * aspect, uv.y);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * miParallax;
  float pixel = 1.0 / res.y;
  // Nearer layers slide further with the pointer.
  vec2 farP = base + ptr * vec2(0.012, 0.004);
  vec2 hotelP = base + ptr * vec2(0.03, 0.006);
  vec2 palmP = base + ptr * vec2(0.065, 0.01);
  vec2 nearP = base + ptr * vec2(0.08, 0.012);
  float shore = miShore(nearP.x, t);

  vec4 c = vec4(0.0);
  if (nearP.y < shore) {
    c = miWater(nearP, t, pixel, shore);
  } else {
    vec4 palm = miPalms(palmP, t, pixel);
    if (palm.a > 0.0) {
      c = palm;
    } else if (nearP.y < MI_BASE) {
      vec4 street = nearP.y > 0.232 ? miStreet(nearP, t, pixel, aspect + 0.4) : vec4(0.0);
      c = street.a > 0.0 ? street : miBeach(nearP, t, pixel);
      // Wet sand just above the waterline mirrors the sky.
      float wet = 1.0 - smoothstep(0.0, 0.02, nearP.y - shore);
      c = mix(c, vec4(0.85, 0.45, 0.65, max(c.a, 0.14)), wet * step(c.a, 0.2));
    } else {
      vec4 hotel = miHotel(hotelP, t, pixel);
      vec4 sky = miSky(farP, t, pixel);
      // The roofline glow lies over the sky rather than replacing it, and
      // dark windows (a near-zero tone) hide the sky behind the facade.
      c = hotel.a > 0.0 && (hotel.a < 0.01 || hotel.a >= sky.a) ? hotel : sky;
    }
  }

  vec3 col = c.rgb;
  if (miOnLight > 0.5) {
    // Pastels vanish on a light paper; deepen them toward their own hue.
    col = col * col * 0.85;
  }
  float tone = c.a * miIntensity;
  // Below the faintest glyph the tone is exactly empty, so open areas of
  // the scene draw clean paper instead of a scatter of dots.
  tone = tone < 0.05 ? 0.0 : tone;
  miCacheUv = uv;
  miCacheT = t;
  miCacheValue = vec4(col, tone);
  return miCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return miScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return miScene(uv, res, t).rgb;
}
`;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(circle at 58% 57%, #ffd480 0 5%, #ff6f8f 7%, transparent 14%), linear-gradient(to bottom, #1a1040 0%, #6a3aa8 35%, #ff5c9a 60%, #ff9a5a 70%, #2a1840 71%, #3a2050 85%, #1a1238 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** True when the paper is light, so the shader deepens its pastels. */
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

export interface MiamiProps extends AsciiSceneProps {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** Brightness of the neon fins, signs and rooflines, from 0 (off) to 1. Default 1. */
  neon?: number;
  /** How many cars drive along Ocean Drive, from 0 (none) to 1. Default 0.6. */
  traffic?: number;
  /** How far the palms and surf move in the breeze, from 0 (still) to 2. Default 1. */
  sway?: number;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** What the pointer does to the glyphs, on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /** Shown without WebGL and until the first frame. Default: a dusk gradient. */
  fallback?: ReactNode;
}

/**
 * Miami. Ocean Drive at dusk, seen from the surf: art deco hotels with
 * stepped crowns and flickering neon fins, palms swaying in front, cars
 * along the drive and waves rolling in under a low sun. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Miami = ({
  intensity = 1,
  neon = 1,
  traffic = 0.6,
  sway = 1,
  paper = "--ascii-paper",
  charset = "standard",
  colorMode,
  phosphor,
  cell = 12,
  fps = 30,
  stillTime = 7,
  interactive = true,
  interaction = "none",
  fallback = FALLBACK,
  ...props
}: MiamiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        miIntensity: clamp(intensity, 0, 1),
        miNeon: clamp(neon, 0, 1),
        miOnLight: onLight ? 1 : 0,
        miParallax: interactive ? 1 : 0,
        miSway: clamp(sway, 0, 2),
        miTraffic: clamp(traffic, 0, 1),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={phosphor === undefined ? paper : undefined}
      cell={cell}
      fps={fps}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};

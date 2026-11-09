"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted cell by cell: every sample takes one colour from the
// layer it lands in, tested near to far (tower, cottage, headland, sea, far
// shore, clouds, sky), and the lamp's halo is laid over the top. Positions
// are in square units, x from 0 to the box's aspect and y from 0 at the
// bottom to 1 at the top, read at each sample's centre so edges land on
// whole cells. The tone follows the colour's brightness, so dot size and
// colour carry the same picture.
const SCENE = `
const float LH_HORIZON = 0.42;
const float LH_SHORE = 0.28;
const float LH_TOP = 0.5;
const float LH_TOWER = 0.25;

// Set once per sample by lhScene and read by every layer.
float lhAspect;
float lhSw;
float lhSh;
float lhT;
float lhAxis;
float lhPulse;
vec2 lhLamp;

// A stable random value for whole-sample inputs.
float lhHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float lhLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// The afterglow is strongest low over the left of the box, where the sun set.
float lhGlowAt(float x) {
  float d = (x - lhAspect * 0.3) / max(lhAspect, 0.7);
  return exp(-d * d * 1.6);
}

// Sky colour at height e above the horizon: peach afterglow, rose, violet,
// then blue deepening overhead.
vec3 lhSkyColor(float x, float e) {
  float g = lhGlowAt(x);
  vec3 low = mix(vec3(0.66, 0.54, 0.66), vec3(1.0, 0.72, 0.48), g);
  vec3 rose = mix(vec3(0.42, 0.36, 0.6), vec3(0.86, 0.48, 0.54), g);
  vec3 violet = vec3(0.32, 0.32, 0.66);
  vec3 blue = vec3(0.11, 0.18, 0.5);
  vec3 night = vec3(0.065, 0.09, 0.25);
  vec3 c = mix(low, rose, smoothstep(0.0, 0.06, e));
  c = mix(c, violet, smoothstep(0.04, 0.15, e));
  c = mix(c, blue, smoothstep(0.12, 0.3, e));
  return mix(c, night, smoothstep(0.28, 0.58, e));
}

// The headland's top edge at x. A grassy plateau under the tower falls to a
// craggy cliff on the sea side and slopes gently away inland; a sea stack
// stands off the cliff foot. Below the shore there is no land.
float lhLand(float x) {
  float d = x - lhAxis;
  // The tower stands on a low knoll; inland the ground falls away gently.
  float top = LH_TOP + 0.012 * exp(-d * d / 0.006) + 0.005 * snoise(vec2(x * 7.0, 1.3));
  top -= 0.07 * smoothstep(0.12, 0.7, d);
  // A steep face below the knoll, then a slope of broken rock to the sea.
  float steep = smoothstep(-0.035, -0.1, d);
  float talus = smoothstep(-0.1, -0.27, d);
  float crag = 0.016 * snoise(vec2(x * 11.0, 4.1)) + 0.004 * snoise(vec2(x * 30.0, 2.0));
  float h = mix(top, LH_SHORE + 0.075, steep);
  h = mix(h, LH_SHORE - 0.02, talus) + crag * steep * (1.0 - talus * 0.6);
  // A ledge partway down the steep face.
  h -= 0.012 * smoothstep(-0.06, -0.07, d) * (1.0 - steep);
  float stack = 0.05 * (1.0 - smoothstep(0.004, 0.024, abs(d + 0.33)));
  stack += 0.006 * snoise(vec2(x * 60.0, 9.0)) * step(0.001, stack);
  return max(h, LH_SHORE + stack - 0.003);
}

// The waterline along the headland's foot, uneven where boulders jut out.
float lhShoreAt(float x) {
  return LH_SHORE - 0.022 * max(0.0, snoise(vec2(x * 11.0, 6.0))) - 0.007 * snoise(vec2(x * 33.0, 2.5));
}

// The far shore: low hazy hills along the horizon on the left and a nearer,
// darker ridge at the very left edge, cooler and paler with distance.
vec4 lhFarShore(vec2 p, out float cover) {
  cover = 0.0;
  float e = p.y - LH_HORIZON;
  if (e < 0.0) {
    return vec4(0.0);
  }
  float far = 0.022 + 0.014 * snoise(vec2(p.x * 2.2, 7.7)) + 0.004 * snoise(vec2(p.x * 9.0, 3.3));
  far *= 1.0 - smoothstep(lhAxis - 0.55, lhAxis - 0.25, p.x);
  float near = 0.075 * (1.0 - smoothstep(0.0, 0.34, p.x)) + 0.006 * snoise(vec2(p.x * 13.0, 5.1));
  vec3 haze = lhSkyColor(p.x, 0.01);
  if (e < near) {
    cover = 1.0;
    float shade = fbm(vec2(p.x * 9.0, p.y * 30.0));
    return vec4(mix(vec3(0.03, 0.03, 0.08), haze, 0.1) * mix(0.6, 1.4, shade), 1.0);
  }
  if (e < far) {
    cover = 1.0;
    // Paler towards the top, where the haze thickens against the glow.
    return vec4(mix(vec3(0.16, 0.15, 0.3), haze, 0.18 + 0.2 * e / max(far, 0.001)), 1.0);
  }
  return vec4(0.0);
}

// The tower: a white tapered shaft lit from the afterglow on the left, a
// dark gallery with its rail, the glazed lantern room and a dark dome.
vec4 lhTower(vec2 p, out float cover) {
  cover = 0.0;
  float h = p.y - LH_TOP + 0.01;
  float dx = p.x - lhAxis;
  if (h < 0.0 || h > LH_TOWER + 0.1 || abs(dx) > 0.05) {
    return vec4(0.0);
  }
  float gallery = LH_TOWER;
  float lanternTop = gallery + 0.052;
  float domeTop = lanternTop + 0.024;
  if (h < gallery) {
    float k = h / LH_TOWER;
    float hw = h < 0.016 ? 0.037 : mix(0.031, 0.021, k);
    if (abs(dx) > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    float u = dx / hw;
    float lit = clamp(0.6 - 0.55 * u + 0.2 * sqrt(max(0.0, 1.0 - u * u)), 0.0, 1.0);
    vec3 c = mix(vec3(0.34, 0.4, 0.64), vec3(0.96, 0.93, 0.94), lit);
    // Warmed from above by the lamp.
    c = mix(c, vec3(1.0, 0.8, 0.54), 0.4 * smoothstep(0.55, 1.0, k) * (0.4 + 0.6 * lit));
    if (h < 0.016) {
      c *= 0.7;
    }
    // Small dark windows climbing the shaft.
    float wy = mod(h - 0.06, 0.065);
    if (h > 0.05 && h < 0.23 && abs(dx + 0.004) < 0.005 && wy < 0.015) {
      c = vec3(0.1, 0.11, 0.2);
    }
    return vec4(c, 1.0);
  }
  if (h < gallery + 0.015) {
    if (abs(dx) > 0.033) {
      return vec4(0.0);
    }
    cover = 1.0;
    float rail = step(gallery + 0.008, h) * step(0.5, mod(floor(p.x / lhSw), 2.0));
    vec3 c = mix(vec3(0.12, 0.11, 0.17), vec3(0.4, 0.3, 0.26), rail);
    return vec4(c + vec3(0.3, 0.17, 0.05) * (1.0 - abs(dx) / 0.033), 1.0);
  }
  if (h < lanternTop) {
    float hw = 0.019;
    if (abs(dx) > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    // Glazing glowing amber, with dark posts at the edges.
    if (abs(dx) > hw - lhSw * 1.5) {
      return vec4(0.18, 0.13, 0.12, 1.0);
    }
    float k = 1.0 - abs(dx) / hw;
    return vec4(mix(vec3(1.0, 0.66, 0.26), vec3(1.0, 0.96, 0.8), k * lhPulse), 1.0);
  }
  if (h < domeTop) {
    float e = (h - lanternTop) / (domeTop - lanternTop);
    float hw = 0.023 * sqrt(max(0.0, 1.0 - e * e));
    if (abs(dx) > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.14, 0.12, 0.18, 1.0);
  }
  if (abs(dx) < lhSw * 0.5 && h < domeTop + 0.016) {
    cover = 1.0;
    return vec4(0.2, 0.17, 0.22, 1.0);
  }
  return vec4(0.0);
}

// The keeper's cottage inland of the tower: whitewashed walls, a dark slate
// roof with a chimney, a door, and one window lit warm.
const float LH_COTTAGE_W = 0.1;
float lhCottageX;
vec2 lhWindow;

vec4 lhCottage(vec2 p, out float cover) {
  cover = 0.0;
  float w = LH_COTTAGE_W;
  float base = lhLand(lhCottageX + w * 0.5) - 0.01;
  float wall = base + 0.046;
  float u = p.x - lhCottageX;
  if (p.y < base || u < -0.012 || u > w + 0.012 || p.y > wall + 0.052) {
    return vec4(0.0);
  }
  vec3 slate = vec3(0.09, 0.09, 0.17);
  vec3 chimney = vec3(0.3, 0.24, 0.28);
  bool stack = u > w * 0.7 && u < w * 0.7 + 0.012;
  if (p.y >= wall) {
    float rise = p.y - wall;
    float inset = rise * 0.95;
    if (rise < 0.034 && u > -0.012 + inset && u < w + 0.012 - inset) {
      cover = 1.0;
      // A paler ridge, and the slates catching the sky.
      float ridge = smoothstep(0.022, 0.034, rise);
      return vec4(mix(slate, vec3(0.62, 0.56, 0.7), ridge), 1.0);
    }
    if (stack && rise < 0.05) {
      cover = 1.0;
      return vec4(chimney, 1.0);
    }
    return vec4(0.0);
  }
  if (u < 0.0 || u > w) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 win = lhWindow - p;
  if (abs(win.x) < 0.012 && abs(win.y) < 0.011) {
    float flick = 0.93 + 0.07 * sin(lhT * 1.1 + sin(lhT * 0.6) * 2.0);
    return vec4(vec3(1.0, 0.76, 0.38) * flick, 1.0);
  }
  if (abs(u - w * 0.7) < 0.009 && p.y < base + 0.032) {
    return vec4(0.12, 0.12, 0.2, 1.0);
  }
  // Lit from the left, falling into shade towards the far end.
  float lit = 1.0 - smoothstep(0.0, w, u) * 0.45;
  return vec4(mix(vec3(0.32, 0.36, 0.56), vec3(0.84, 0.8, 0.84), lit * 0.85), 1.0);
}

// Soft foam where the swells break on the rocks and round the stack: a
// lacy band along the waterline that swells and ebbs as each one comes in,
// washing a little way up the rock and spreading out over the water.
float lhFoam(vec2 p) {
  float edge = p.y - lhShoreAt(p.x);
  if (edge < -0.04 || edge > 0.03 || lhLand(p.x) <= LH_SHORE + 0.002) {
    return 0.0;
  }
  float surge = 0.5 + 0.5 * sin(lhT * 0.42 - p.x * 8.0 + 2.0 * snoise(vec2(p.x * 4.0, 1.0)));
  float lace = snoise(vec2(p.x * 40.0, p.y * 90.0 - lhT * 0.18)) + 0.5 * snoise(vec2(p.x * 90.0 + lhT * 0.05, p.y * 160.0));
  float up = 1.0 - smoothstep(0.0, 0.006 + 0.016 * surge, edge);
  float spill = 1.0 - smoothstep(0.0, 0.008 + 0.026 * surge, -edge);
  float band = edge > 0.0 ? up : spill;
  float patchy = smoothstep(0.0, 0.7, snoise(vec2(p.x * 9.0 - lhT * 0.03, 3.0)) + surge * 0.5);
  return clamp(band * patchy * smoothstep(-0.4, 0.4, lace + surge * 0.9 - 0.3), 0.0, 1.0);
}

// Rock and turf of the headland: strata, cracks in deep shadow, faces
// catching the afterglow, turf on top, wet and dark at the waterline, and
// warmed near the tower by the lamp.
vec4 lhRock(vec2 p, float top, out float cover) {
  cover = 0.0;
  if (p.y > top || p.y < lhShoreAt(p.x) || top < LH_SHORE) {
    return vec4(0.0);
  }
  cover = 1.0;
  float depth = top - p.y;
  // Broken rock in relief: a height made of noise, lit from the upper left.
  vec2 q = p * vec2(5.0, 8.0);
  float rh = fbm(q);
  float e2 = 0.03;
  vec2 grad = vec2(fbm(q + vec2(e2, 0.0)) - rh, fbm(q + vec2(0.0, e2)) - rh) / e2;
  float relief = clamp(0.5 + 0.22 * dot(grad, vec2(-0.6, 0.8)), 0.0, 1.0);
  float strata = fbm(vec2(p.x * 9.0, p.y * 30.0));
  float crack = smoothstep(0.62, 0.7, fbm(vec2(p.x * 26.0 + 3.0, p.y * 7.0)));
  vec3 rock = mix(vec3(0.045, 0.045, 0.1), vec3(0.4, 0.36, 0.52), smoothstep(0.4, 0.78, relief) * mix(0.7, 1.0, strata));
  // Faces turned to the left catch the afterglow along the cliff.
  float slope = lhLand(p.x + 0.015) - lhLand(p.x - 0.015);
  float face = smoothstep(0.004, 0.03, slope) * (1.0 - smoothstep(0.04, 0.2, depth));
  rock = mix(rock, vec3(0.95, 0.6, 0.55) * mix(0.55, 1.15, relief), face * 0.85);
  rock *= 1.0 - 0.6 * crack;
  // Turf on the plateau, catching the blue sky.
  if (depth < 0.016 && top > LH_TOP - 0.08) {
    rock = mix(vec3(0.1, 0.17, 0.22), vec3(0.3, 0.42, 0.44), relief);
  }
  rock *= mix(0.6, 1.0, smoothstep(LH_SHORE, LH_SHORE + 0.08, p.y));
  // A pale rim where the top edge catches the sky.
  rock += vec3(0.2, 0.18, 0.26) * (1.0 - smoothstep(0.0, 0.006, depth));
  float lamp = exp(-length((p - lhLamp) * vec2(1.0, 1.4)) / 0.13);
  rock += vec3(0.5, 0.3, 0.1) * lamp * 0.5 * lhPulse;
  return vec4(mix(rock, vec3(0.82, 0.88, 0.98), lhFoam(p) * 0.65), 1.0);
}

// The swell seen in perspective, as a slope that tilts the sky the sea
// reflects. It fades out near the horizon, where it would change faster
// than a row.
float lhSwell(vec2 p) {
  float d = max(LH_HORIZON - p.y, 0.003);
  float z = 0.06 / d;
  float wx = (p.x - lhAspect * 0.5) * z;
  float a = sin(z * 110.0 - lhT * 0.6 + 2.5 * sin(wx * 2.0 + lhT * 0.07));
  float b = sin(z * 170.0 + wx * 9.0 - lhT * 0.9);
  float c = snoise(vec2(wx * 6.0, z * 40.0 - lhT * 0.15));
  // Radians of swell per row: the swell fades where it would alias.
  float perRow = 110.0 * 0.06 / (d * d) * lhSh;
  float fade = 1.0 - smoothstep(0.9, 1.8, perRow);
  return (0.55 * a + 0.25 * b + 0.4 * c) * fade;
}

vec3 lhSea(vec2 p) {
  float d = LH_HORIZON - p.y;
  float swell = lhSwell(p);
  // Calm water mirrors the sky, paler far off and darker near; swells
  // tilt the mirror up and down.
  float e = d * 0.65 + 0.01 + 0.04 * swell * smoothstep(0.0, 0.06, d);
  vec3 c = lhSkyColor(p.x, e) * mix(0.74, 0.6, smoothstep(0.0, 0.3, d));
  // A thin bright line where the sea meets the sky.
  c = mix(c, lhSkyColor(p.x, 0.0), 0.8 * (1.0 - smoothstep(lhSh, 2.5 * lhSh, d)));
  c = mix(c, vec3(0.07, 0.1, 0.26), smoothstep(0.12, 0.42, d) * 0.5);
  // Swell crests catch the pale horizon; troughs fall into shadow.
  float near = smoothstep(0.02, 0.12, d);
  c = mix(c, lhSkyColor(p.x, 0.03 + 0.25 * d) * 1.1, 0.75 * smoothstep(0.35, 0.9, swell) * near);
  c *= 1.0 - 0.35 * smoothstep(-0.1, -0.8, swell) * near;
  // The headland's dark reflection below its foot.
  float below = LH_SHORE - p.y;
  if (below > 0.0) {
    float wob = 0.006 * sin(p.y * 180.0 + lhT * 0.8) + 0.004 * swell;
    float my = LH_SHORE + below;
    if (my < lhLand(p.x + wob)) {
      c = mix(c, vec3(0.05, 0.06, 0.15), 0.65 * (1.0 - smoothstep(0.0, 0.22, below)));
    }
  }
  // The lamp's path on the water: a warm column breaking into dashes.
  if (below > -0.01) {
    float spread = 0.022 + 0.14 * max(below, 0.0);
    float lane = exp(-pow((p.x - lhAxis) / spread, 2.0));
    float glint = smoothstep(-0.5, 0.4, snoise(vec2(p.x * 18.0, p.y * 90.0 - lhT * 0.3)) + 0.6 * swell);
    float path = lane * glint * (1.0 - 0.45 * smoothstep(0.0, 0.3, below)) * lhPulse;
    c = mix(c, vec3(1.0, 0.76, 0.42), clamp(path, 0.0, 1.0) * 0.95);
  }
  return mix(c, vec3(0.82, 0.88, 0.98), lhFoam(p) * 0.65);
}

// Long thin clouds low in the sky, lit rose underneath on the glow side,
// drifting very slowly to the right.
vec3 lhClouds(vec2 p, vec3 sky) {
  float e = p.y - LH_HORIZON;
  float band = smoothstep(0.06, 0.12, e) * (1.0 - smoothstep(0.24, 0.36, e));
  if (band <= 0.0 || lhCloudsOn < 0.5) {
    return sky;
  }
  vec2 q = vec2(p.x * 1.1 - lhT * 0.004, e * 7.0);
  float n = fbm(q);
  float cloud = smoothstep(0.5, 0.66, n) * band;
  // Undersides lit by the afterglow: where the cloud thins just below.
  float under = 1.0 - smoothstep(0.48, 0.6, fbm(q - vec2(0.0, 0.12)));
  vec3 dark = vec3(0.26, 0.25, 0.44);
  vec3 lit = mix(vec3(0.5, 0.42, 0.66), vec3(0.98, 0.6, 0.56), lhGlowAt(p.x));
  vec3 cc = mix(dark, lit, under * smoothstep(0.3, 0.12, e));
  return mix(sky, cc, cloud * 0.8);
}

// Sparse stars higher up, each twinkling slowly.
vec3 lhStars(vec2 s, vec2 p, vec3 sky) {
  float e = p.y - LH_HORIZON;
  float h = lhHash(s + 17.0);
  float density = 0.022 * smoothstep(0.18, 0.5, e) * lhStarsOn;
  if (h > 1.0 - density) {
    float twinkle = 0.65 + 0.35 * sin(lhT * (0.4 + h * 0.5) + lhHash(s + 3.0) * 40.0);
    float star = twinkle * mix(0.55, 1.0, lhHash(s + 9.0));
    vec3 col = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.9, 0.76), step(0.7, lhHash(s + 5.0)));
    return mix(sky, col, star);
  }
  return sky;
}

vec2 lhCacheUv = vec2(-1.0);
float lhCacheT = -1.0;
vec4 lhCacheValue = vec4(0.0);

vec4 lhScene(vec2 uv, vec2 res, float t) {
  if (uv == lhCacheUv && t == lhCacheT) {
    return lhCacheValue;
  }
  lhAspect = res.x / res.y;
  lhSh = 1.0 / res.y;
  lhSw = lhAspect / max(ascii_samples.x, 1.0);
  lhT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  vec2 p = (s + 0.5) * vec2(lhSw, lhSh);
  // Right of centre on wide boxes, so a headline fits in the middle;
  // nearer the middle on tall ones.
  float axis = lhAspect * mix(0.56, 0.74, smoothstep(0.8, 1.6, lhAspect));
  lhAxis = (floor(axis / lhSw) + 0.5) * lhSw;
  lhCottageX = lhAxis + 0.058;
  lhWindow = vec2(lhCottageX + LH_COTTAGE_W * 0.3, lhLand(lhCottageX + LH_COTTAGE_W * 0.5) + 0.016);
  lhLamp = vec2(lhAxis, LH_TOP - 0.01 + LH_TOWER + 0.04);
  // A slow, gentle breath, about every eleven seconds.
  lhPulse = 0.84 + 0.16 * sin(t * 0.57);

  vec3 col;
  float cover;
  vec4 hit = lhTower(p, cover);
  if (cover < 0.5) {
    hit = lhCottage(p, cover);
  }
  if (cover < 0.5) {
    hit = lhRock(p, lhLand(p.x), cover);
  }
  if (cover > 0.5) {
    col = hit.rgb;
  } else if (p.y < LH_HORIZON) {
    col = lhSea(p);
  } else {
    hit = lhFarShore(p, cover);
    if (cover > 0.5) {
      col = hit.rgb;
    } else {
      col = lhStars(s, p, lhClouds(p, lhSkyColor(p.x, p.y - LH_HORIZON)));
    }
  }
  // The lamp's halo: a tight warm core, a soft bloom and a wide warm wash.
  float r = length((p - lhLamp) * vec2(1.0, 1.15));
  float core = exp(-r / 0.028) * lhPulse;
  float bloom = exp(-r / 0.1) * lhPulse;
  col = mix(col, vec3(1.0, 0.86, 0.58), clamp(core * 1.3, 0.0, 1.0));
  col = mix(col, col * vec3(0.7, 0.6, 0.45), bloom);
  col += vec3(0.75, 0.42, 0.1) * bloom * 0.8 + vec3(0.2, 0.1, 0.02) * exp(-r / 0.22) * lhPulse;
  // The cottage window's small glow.
  vec2 dw = p - lhWindow;
  col += vec3(0.4, 0.24, 0.08) * exp(-length(dw) / 0.014);

  col = clamp(col, 0.0, 1.0);
  // Dot size follows brightness: a faint dot in the night and the deep
  // water, full dots in the lamp, the tower and the afterglow. A little
  // fixed jitter per cell breaks gradients into mixed dots instead of hard
  // steps, and the ink is lifted a touch because a dot covers only part of
  // its cell.
  float jitter = (lhHash(s + 31.0) - 0.5) * 0.1;
  float tone = 0.1 + pow(lhLuma(col), 0.65) + jitter;
  vec3 ink = pow(col, vec3(0.75));
  lhCacheUv = uv;
  lhCacheT = t;
  lhCacheValue = vec4(ink * mix(0.3, 1.0, lhIntensity), clamp(tone, 0.0, 1.0) * mix(0.6, 1.0, lhIntensity));
  return lhCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return lhScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return lhScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#05070f";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0b1030 0%, #1c2456 40%, #4a3c5c 56%, #24284a 60%, #060914 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface LighthouseProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (quiet, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Cell height in CSS pixels. Default 7. */
  cell?: number;
  /** Square cells, so the halftone dots lie on an even lattice. Default `true`. */
  square?: boolean;
  /** The first stars coming out high in the sky. Default `true`. */
  stars?: boolean;
  /** Long thin clouds drifting low over the afterglow. Default `true`. */
  clouds?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's own night in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, amber on the night. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the blue hour as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the scene never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A lighthouse on a rocky headland at blue hour, painted in halftone dots.
 * The white tower's lamp glows amber and breathes slowly, a keeper's cottage
 * keeps one window lit, swells break into foam on the rocks and the sky
 * fades from afterglow to the first stars. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const Lighthouse = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 6,
  intensity = 1,
  stars = true,
  clouds = true,
  fallback = FALLBACK,
  // The scene has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: LighthouseProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        lhCloudsOn: clouds ? 1 : 0,
        lhIntensity: clamp(intensity, 0, 1),
        lhStarsOn: stars ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

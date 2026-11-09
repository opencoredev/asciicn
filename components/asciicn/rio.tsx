"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  CharsetName,
  ColorMode,
} from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Rio at dusk from the water, painted in dots: every sample works out a
// colour, and the dot size follows its brightness, as in a halftone print.
// The scene is laid out in scene units (x across from the middle, y up from
// the bottom, both in box heights) and shrinks about the waterline on tall
// boxes, so both peaks stay in view on a phone. Layers are tested near to
// far: Sugarloaf, the cable and its car, Morro da Urca, Copacabana along
// the shore, the Corcovado range with the statue, a far hazy range, then
// the sky. Rows below the waterline are the bay, which reads the same
// layers mirrored. Small lit things (the statue, the car, lamps, windows)
// are placed on whole samples, so they stay crisp dots at any size.
const SCENE = `
// Set once per sample by rioScene and read by every layer.
float rioT;
float rioAspect;
float rioSw;
float rioSh;
float rioK;
float rioW;
float rioWaterRow;
float rioHalf;
float rioCorX;
float rioUrcaX;
float rioUrcaR;
float rioLoafX;
float rioSunX;
float rioBeach0;
float rioBeach1;
float rioSkyScale;

const float RIO_COR_H = 0.4;
const float RIO_URCA_H = 0.13;
const float RIO_LOAF_H = 0.37;
const float RIO_LOAF_R = 0.115;
const float RIO_LEAN = 0.045;

// A stable random value for whole-sample inputs; hash21 repeats every 50
// samples on integers, which shows as tiled stars.
float rioHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Box point (x from the middle, y from the bottom) of a whole sample.
vec2 rioBox(vec2 s) {
  return vec2((s.x + 0.5) * rioSw - rioAspect * 0.5, (s.y + 0.5) * rioSh);
}

vec2 rioSampleOf(vec2 p) {
  return floor(vec2((p.x + rioAspect * 0.5) / rioSw, p.y / rioSh));
}

vec2 rioToScene(vec2 p) {
  return vec2(p.x / rioK, rioW + (p.y - rioW) / rioK);
}

vec2 rioToBox(vec2 q) {
  return vec2(q.x * rioK, rioW + (q.y - rioW) * rioK);
}

// How close to the set sun, 1 under it and falling off to either side.
float rioSunward(float x) {
  return exp(-abs(x - rioSunX) / 0.45);
}

// The dusk sky: warm gold on the horizon through orange and rose to violet
// and a deep indigo overhead, with a wide glow where the sun went down.
vec3 rioSky(vec2 q) {
  // On tall boxes the scene is drawn smaller, so the gradient is spread
  // back out to fill the sky above it.
  float h = (q.y - rioW) * rioSkyScale;
  vec3 c = vec3(0.8, 0.46, 0.36);
  c = mix(c, vec3(0.7, 0.36, 0.4), smoothstep(0.02, 0.14, h));
  c = mix(c, vec3(0.46, 0.25, 0.44), smoothstep(0.1, 0.3, h));
  c = mix(c, vec3(0.24, 0.15, 0.38), smoothstep(0.24, 0.46, h));
  c = mix(c, vec3(0.1, 0.08, 0.24), smoothstep(0.4, 0.7, h));
  c = mix(c, vec3(0.06, 0.055, 0.16), smoothstep(0.66, 0.95, h));
  // The afterglow: wide and low, gold at its heart, so the brightest dots
  // gather on the horizon and the air above the headline stays soft.
  vec2 d = (q - vec2(rioSunX, rioW)) * vec2(0.36, 1.0);
  float glow = exp(-length(d) / 0.11);
  c = mix(c, vec3(1.0, 0.68, 0.4), clamp(glow, 0.0, 1.0));
  vec2 e = (q - vec2(rioSunX, rioW)) * vec2(0.45, 1.0);
  c = mix(c, vec3(1.0, 0.92, 0.7), clamp(1.2 * exp(-length(e) / 0.04), 0.0, 1.0));
  return c;
}

// Thin streaks of cloud low in the sky, lit gold and rose from below,
// drifting very slowly.
vec3 rioClouds(vec2 q, vec3 sky) {
  float h = (q.y - rioW) * rioSkyScale;
  float band = smoothstep(0.07, 0.15, h) * (1.0 - smoothstep(0.28, 0.44, h));
  if (band <= 0.0) {
    return sky;
  }
  vec2 c = vec2(q.x * 1.4 - rioT * 0.005, h * 15.0);
  float n = fbm(c + vec2(1.2 * fbm(c * 0.6 + 3.0), 0.0));
  float a = smoothstep(0.55, 0.8, n) * band * (1.0 - 0.6 * exp(-q.x * q.x / 0.12));
  vec3 lit = mix(vec3(1.0, 0.66, 0.46), vec3(0.74, 0.42, 0.6), smoothstep(0.1, 0.34, h));
  lit = mix(lit, vec3(1.0, 0.84, 0.58), rioSunward(q.x) * 0.45);
  return mix(sky, lit, a * 0.6);
}

// The first stars, only where the sky has darkened, each on its own slow
// twinkle.
vec3 rioStars(vec2 s, vec2 q, vec3 sky) {
  float h = rioHash(s + 17.0);
  float density = 0.012 * smoothstep(0.42, 0.7, (q.y - rioW) * rioSkyScale);
  if (h < 1.0 - density) {
    return sky;
  }
  float twinkle = 0.7 + 0.3 * sin(rioT * (0.3 + rioHash(s + 3.0) * 0.5) + h * 50.0);
  return mix(sky, vec3(0.88, 0.88, 1.0), 0.55 * twinkle);
}

// A ridge falling away from a peak: steep near it, easing off to a cap.
float rioFall(float d, float slope, float cap) {
  float v = slope * (sqrt(d * d + 0.0004) - 0.02);
  return cap * (1.0 - exp(-max(v, 0.0) / cap));
}

// The far hazy range across the whole bay, dipping where the sun set.
float rioFarTop(float x) {
  float n = 0.5 + 0.5 * snoise(vec2(x * 2.1, 3.1));
  float n2 = snoise(vec2(x * 6.3, 7.3));
  float dip = 0.035 * exp(-pow((x - rioSunX) / 0.2, 2.0));
  return rioW + 0.045 + 0.05 * n + 0.01 * n2 - dip;
}

// The Corcovado range: a sharp peak with a cliff on the sunward side, and
// the Tijuca range carrying on to the left with a second shoulder.
float rioCorTop(float x) {
  float d = x - rioCorX;
  // The granite needle at the top, over a broader forested mass.
  // Flat across one sample, so the summit column always reaches the peak
  // and the statue stands on rock.
  float needle = rioW + RIO_COR_H - (d < 0.0 ? 2.2 : 2.9) * max(abs(d) - rioSw / rioK, 0.0);
  float body = rioW + RIO_COR_H - 0.06 - (d < 0.0 ? rioFall(d, 1.2, 0.24) : rioFall(d, 1.9, 0.3));
  float top = max(needle, body);
  float d2 = x - (rioCorX - 0.42);
  top = max(top, rioW + 0.23 - rioFall(d2, 0.9, 0.16));
  float rough = 0.012 * snoise(vec2(x * 7.0, 1.7)) + 0.006 * snoise(vec2(x * 19.0, 4.2)) + 0.003 * snoise(vec2(x * 47.0, 6.1));
  return top + rough * smoothstep(0.008, 0.05, abs(d));
}

// The nearer foothills under Corcovado, darker and rounder, running down
// to the shore behind the city.
float rioHillTop(float x) {
  float n = 0.5 + 0.5 * snoise(vec2(x * 3.4, 12.0));
  float n2 = snoise(vec2(x * 11.0, 5.0));
  float fade = 1.0 - smoothstep(rioUrcaX - rioUrcaR * 1.6, rioUrcaX - rioUrcaR * 0.6, x);
  return rioW + (0.035 + 0.05 * n + 0.008 * n2) * fade;
}

// Slope of a ridge line at x, for shading its faces from the side.
float rioSlope(float top0, float top1, float e) {
  return (top1 - top0) / e;
}

// A mountain face: dark where it faces you, warmer and lighter where it
// turns towards the sun, with gullies running down it, and paling into
// haze towards its foot.
vec3 rioFace(vec2 q, float top, float slope, vec3 dark, vec3 lit, float hazeAmt, float seed) {
  float side = sign(rioSunX - q.x);
  float turn = smoothstep(0.0, 0.8, -side * slope);
  float gully = fbm(vec2(q.x * 34.0 + seed, (top - q.y) * 9.0 + q.x * 6.0));
  float light = turn * (0.55 + 0.6 * gully) * (1.0 - smoothstep(0.0, 0.2, top - q.y) * 0.5);
  vec3 c = mix(dark, lit, clamp(light, 0.0, 1.0));
  c *= 0.85 + 0.25 * fbm(q * vec2(40.0, 55.0) + seed);
  vec3 haze = rioSky(vec2(q.x, rioW + 0.06));
  return mix(c, mix(haze, dark, 0.45), smoothstep(0.03, 0.28, top - q.y) * hazeAmt);
}

// Morro da Urca: a long slope down to the shore on the left, steeper where
// it meets Sugarloaf, with a lesser knoll on its shoulder.
float rioUrcaTop(float x) {
  float d = (x - rioUrcaX) / (rioUrcaR * (x < rioUrcaX ? 1.25 : 0.75));
  if (abs(d) >= 1.0) {
    return -1.0;
  }
  float body = 1.0 - d * d;
  float lump = 0.012 * snoise(vec2(x * 9.0, 2.0)) + 0.005 * snoise(vec2(x * 31.0, 8.0));
  float knoll = 0.022 * exp(-pow((d + 0.55) / 0.2, 2.0));
  return rioW + RIO_URCA_H * pow(body, 0.8) + knoll + lump * body;
}

// Sugarloaf as a leaning dome: near-vertical sides that flare at the water
// and round over at the top. Returns -2 outside, else the position across
// the dome from -1 (sunward side) to 1.
float rioLoaf(vec2 q) {
  float t = (q.y - rioW) / RIO_LOAF_H;
  if (t < 0.0 || t > 1.0) {
    return -2.0;
  }
  float c = rioLoafX - RIO_LEAN * t;
  float hw = RIO_LOAF_R * sqrt(max(0.0, 1.0 - pow(t, 2.6))) * (1.0 + 0.55 * pow(1.0 - t, 4.0));
  hw *= 1.0 + 0.035 * snoise(vec2(q.y * 26.0, q.x > c ? 3.0 : 9.0)) + 0.015 * snoise(vec2(q.y * 70.0, 5.0));
  float u = (q.x - c) / max(hw, 1e-4);
  return abs(u) < 1.0 ? u : -2.0;
}

vec2 rioLoafTop() {
  return vec2(rioLoafX - RIO_LEAN, rioW + RIO_LOAF_H);
}

// The beach's lamp line as a height above the waterline: a crescent whose
// middle lies farther off, and so higher, than its ends.
float rioBeachY(float x) {
  float u = clamp((x - rioBeach0) / (rioBeach1 - rioBeach0), 0.0, 1.0);
  return rioW + 0.006 + 0.034 * pow(sin(3.14159 * u), 0.8);
}

bool rioOnBeach(float x) {
  return x > rioBeach0 && x < rioBeach1;
}

// Cable from the top of Urca to the top of Sugarloaf, in box units.
vec2 rioCableA() {
  return rioToBox(vec2(rioUrcaX + 0.01, rioW + RIO_URCA_H + 0.006));
}

vec2 rioCableB() {
  return rioToBox(rioLoafTop() + vec2(-0.004, -0.004));
}

vec2 rioCableAt(float u) {
  vec2 a = rioCableA();
  vec2 b = rioCableB();
  vec2 p = mix(a, b, u);
  p.y -= 0.018 * rioK * sin(3.14159 * u);
  return p;
}

// The one car: waits 12 seconds at each station and takes 30 to cross.
float rioCarU() {
  float c = mod(rioT + 15.0, 84.0);
  if (c < 12.0) {
    return 0.0;
  }
  if (c < 42.0) {
    return smoothstep(0.0, 1.0, (c - 12.0) / 30.0);
  }
  if (c < 54.0) {
    return 1.0;
  }
  return 1.0 - smoothstep(0.0, 1.0, (c - 54.0) / 30.0);
}

// A lamp's light, twinkling gently and each on its own beat.
float rioTwinkle(vec2 id) {
  float h = rioHash(id + 5.0);
  return 0.8 + 0.2 * sin(rioT * (0.4 + h * 0.8) + h * 40.0);
}

// Everything above the water at sample s, as a colour.
vec3 rioAbove(vec2 s) {
  vec2 p = rioBox(s);
  vec2 q = rioToScene(p);
  float h = q.y - rioW;
  float sunward = rioSunward(q.x);
  vec3 haze = rioSky(vec2(q.x, rioW + 0.03));
  float e = 0.004;

  // Christ the Redeemer, pale on the summit of Corcovado: a column with
  // arms straight out, a few samples tall whatever the box size.
  vec2 peak = rioSampleOf(rioToBox(vec2(rioCorX, rioW + RIO_COR_H)));
  float rise = max(4.0, floor(0.026 / rioSh + 0.5));
  float arm = max(1.0, floor(0.009 / rioSw + 0.5));
  vec2 st = s - peak;
  if ((st.x == 0.0 && st.y >= 0.0 && st.y <= rise) || (st.y == rise - 1.0 && abs(st.x) <= arm)) {
    return st.y < 0.5 ? vec3(0.62, 0.64, 0.8) : vec3(0.92, 0.95, 1.0);
  }

  // Sugarloaf, darkest and nearest: granite in shadow facing you, its
  // sunward flank and crown turned to the afterglow, streaked by the
  // weather down its walls.
  float u = rioLoaf(q);
  if (u > -1.5) {
    float t = h / RIO_LOAF_H;
    float streak = fbm(vec2(q.x * 70.0, q.y * 4.0));
    // The flank towards the sun takes the light; the face fades to shadow.
    float turn = (1.0 - smoothstep(-0.95, 0.5, u)) * (0.45 + 0.55 * t);
    float crown = smoothstep(0.7, 1.0, t) * (1.0 - abs(u)) * 0.45;
    vec3 c = mix(vec3(0.07, 0.065, 0.15), vec3(0.62, 0.34, 0.4), clamp((turn + crown) * (0.45 + 0.75 * streak), 0.0, 1.0));
    c *= 0.88 + 0.22 * fbm(q * vec2(50.0, 30.0) + 4.0);
    // A lit rim on the sunward edge.
    c = mix(c, vec3(1.0, 0.64, 0.5), (1.0 - smoothstep(-0.97, -0.82, u)) * (0.5 + 0.4 * t));
    // Forest at its foot.
    c = mix(c, vec3(0.05, 0.08, 0.11), (1.0 - smoothstep(0.03, 0.14, t)) * 0.7);
    // The upper station's light.
    vec2 top = rioSampleOf(rioCableB());
    if (s == top || s == top - vec2(0.0, 1.0)) {
      c = vec3(1.0, 0.84, 0.56);
    }
    return c;
  }

  // The cable car and its cable, across the sky between the two peaks.
  if (rioCableOn > 0.5) {
    vec2 car = rioSampleOf(rioCableAt(rioCarU()));
    if (s == car - vec2(0.0, 1.0)) {
      return vec3(1.0, 0.92, 0.7);
    }
    if (s == car) {
      return vec3(0.7, 0.62, 0.66);
    }
    vec2 a = rioCableA();
    vec2 b = rioCableB();
    if (p.x > a.x && p.x < b.x) {
      float cu = (p.x - a.x) / (b.x - a.x);
      float cy = rioCableAt(cu).y;
      float slope = (b.y - a.y) / (b.x - a.x);
      if (abs(p.y - cy) < 0.5 * rioSh * sqrt(1.0 + slope * slope)) {
        // Backlit by the glow: a fine dark line through the dots.
        return mix(rioSky(q), vec3(0.1, 0.07, 0.16), 0.85);
      }
    }
  }

  // Morro da Urca, low and forested, in front of the shore.
  float urca = rioUrcaTop(q.x);
  if (q.y < urca) {
    float slope = rioSlope(rioUrcaTop(q.x - e), rioUrcaTop(q.x + e), 2.0 * e);
    vec3 c = rioFace(q, urca, slope, vec3(0.06, 0.075, 0.13), vec3(0.26, 0.2, 0.3), 0.15, 3.0);
    // Treetops: the nearest hill carries the finest texture.
    c *= 0.65 + 0.7 * fbm(q * vec2(110.0, 140.0) + 21.0);
    float edge = 1.0 - smoothstep(0.003, 0.01, urca - q.y);
    c = mix(c, vec3(0.8, 0.46, 0.5), edge * 0.45 * sunward);
    // The houses of Urca along the water at its foot.
    if (h < 0.018 && rioHash(s + 53.0) < 0.16) {
      c = vec3(1.0, 0.74, 0.44) * (0.55 + 0.35 * rioHash(s + 54.0));
    }
    vec2 base = rioSampleOf(rioCableA());
    if (s == base || s == base - vec2(0.0, 1.0)) {
      c = vec3(1.0, 0.84, 0.56);
    }
    return c;
  }

  // Copacabana: the lamps along the promenade in a crescent, the sand below
  // them and a low wall of apartment blocks with lit windows behind.
  if (rioOnBeach(q.x) && h < 0.08) {
    float lampRow = rioSampleOf(rioToBox(vec2(q.x, rioBeachY(q.x)))).y;
    float across = clamp((q.x - rioBeach0) / (rioBeach1 - rioBeach0), 0.0, 1.0);
    if (s.y == lampRow) {
      if (mod(s.x, 4.0) < 0.5) {
        return vec3(1.0, 0.78, 0.44) * rioTwinkle(s);
      }
      return vec3(0.34, 0.24, 0.28);
    }
    if (s.y < lampRow) {
      // Sand, warmed by the lamps just above it.
      return s.y + 1.0 == lampRow ? vec3(0.42, 0.3, 0.3) : vec3(0.2, 0.15, 0.22);
    }
    float bw = 0.02 + 0.012 * rioHash(vec2(floor(q.x / 0.03), 1.0));
    float id = floor(q.x / bw);
    float tall = (0.012 + 0.03 * rioHash(vec2(id, 3.0))) * (0.45 + 0.55 * sin(3.14159 * across));
    float rowsUp = s.y - lampRow;
    if (rowsUp <= max(1.0, floor(tall * rioK / rioSh + 0.5))) {
      vec3 c = mix(vec3(0.09, 0.08, 0.17), haze * 0.3, 0.3);
      // Windows: most stay as they are; a few change every couple of minutes.
      float epoch = floor((rioT + rioHash(s + 2.0) * 120.0) / 120.0);
      float lit = rioHash(s + 11.0) < 0.2 ? 1.0 : 0.0;
      if (rioHash(s + 29.0) < 0.06) {
        lit = rioHash(s + epoch * 7.0) < 0.5 ? 1.0 : 0.0;
      }
      if (lit > 0.5) {
        c = mix(vec3(0.9, 0.64, 0.4), vec3(0.62, 0.68, 0.86), step(0.8, rioHash(s + 4.0))) * (0.5 + 0.25 * rioHash(s + 6.0));
      }
      return c;
    }
  }

  // The foothills behind the city, with homes lit on their slopes.
  float hill = rioHillTop(q.x);
  if (q.y < hill) {
    float slope = rioSlope(rioHillTop(q.x - e), rioHillTop(q.x + e), 2.0 * e);
    vec3 c = rioFace(q, hill, slope, vec3(0.08, 0.075, 0.16), vec3(0.2, 0.14, 0.24), 0.2, 7.0);
    if (rioHash(s + 41.0) < 0.07 * (1.0 - smoothstep(0.0, 0.08, h))) {
      c = vec3(0.9, 0.62, 0.38) * (0.45 + 0.3 * rioHash(s + 9.0));
    }
    return c;
  }

  // The Corcovado range: backlit and paling into haze down its faces, the
  // flanks that turn towards the sun warmer, and a pale glow from the
  // floodlights round the statue.
  float cor = rioCorTop(q.x);
  vec2 lamp = rioToBox(vec2(rioCorX, rioW + RIO_COR_H + 0.015));
  float flood = exp(-length((p - lamp) * vec2(1.0, 0.7)) / (0.02 * max(rioK, 0.7)));
  if (q.y < cor) {
    float slope = rioSlope(rioCorTop(q.x - e), rioCorTop(q.x + e), 2.0 * e);
    vec3 c = rioFace(q, cor, slope, vec3(0.13, 0.1, 0.23), vec3(0.3, 0.18, 0.32), 0.45, 1.0);
    float edge = 1.0 - smoothstep(0.003, 0.01, cor - q.y);
    c = mix(c, vec3(0.95, 0.6, 0.54), edge * (0.15 + 0.45 * sunward));
    // The floodlights catch the rock just under the statue.
    c = mix(c, vec3(0.6, 0.6, 0.8), clamp(flood * 1.1, 0.0, 0.6));
    return c;
  }

  // The far range, low in contrast and close to the sky's colour, warmed
  // where the sun went down.
  float far = rioFarTop(q.x);
  if (q.y < far) {
    vec3 sky = rioSky(vec2(q.x, rioW + 0.05));
    vec3 c = mix(vec3(0.34, 0.2, 0.36), sky, 0.45);
    c *= 0.94 + 0.1 * fbm(q * vec2(20.0, 30.0) + 2.0);
    float edge = 1.0 - smoothstep(0.003, 0.01, far - q.y);
    c = mix(c, vec3(1.0, 0.74, 0.52), edge * 0.5 * exp(-abs(q.x - rioSunX) / 0.2));
    // Mist on the water at its foot.
    c = mix(c, haze, (1.0 - smoothstep(0.0, 0.025, h)) * 0.45);
    return c;
  }

  vec3 sky = rioStars(s, q, rioClouds(q, rioSky(q)));
  return mix(sky, vec3(0.7, 0.72, 0.95), clamp(flood * 0.25, 0.0, 0.25));
}

// The bay: everything above mirrored, darker and cooler, broken by ripples
// that widen towards you, with the afterglow laid on it as a long
// shimmering streak and the beach lamps drawn down into the water.
vec3 rioWater(vec2 s) {
  vec2 p = rioBox(s);
  float k = rioW - p.y;
  float dn = clamp(k / rioW, 0.0, 1.0);
  float rip = snoise(vec2(p.x * mix(8.0, 2.8, dn) + rioT * 0.015, k * mix(120.0, 34.0, dn) - rioT * 0.4));
  float rip2 = snoise(vec2(p.x * 3.0 - rioT * 0.01, k * mix(60.0, 20.0, dn) + rioT * 0.28 + 7.0));
  float off = floor(rip2 * (0.002 + 0.012 * dn) / rioSw + 0.5);
  vec2 m = vec2(s.x + off, 2.0 * rioWaterRow - 1.0 - s.y);
  vec3 col = rioAbove(m) * mix(0.78, 0.45, dn);
  col = mix(col, col * vec3(0.76, 0.86, 1.18), 0.45) + vec3(0.015, 0.018, 0.05);
  col *= 0.88 + 0.24 * (0.5 + 0.5 * rip);
  // The bay's own colour: the sky above, dimmed, which lifts the mirrored
  // hills out of black the nearer the water comes.
  vec3 bay = rioSky(vec2(p.x / rioK, rioW + 0.2)) * 0.3;
  col = mix(col, max(col, bay), 0.35 + 0.4 * dn);
  // The afterglow's streak, broken into dashes that drift towards you.
  float sunX = rioSunX * rioK;
  float dx = p.x - sunX;
  float w = mix(0.05, 0.16, dn) * max(rioK, 0.6);
  float streak = exp(-dx * dx / (w * w)) * mix(1.0, 0.45, dn);
  float dash = smoothstep(-0.25, 0.6, rip);
  col = mix(col, vec3(1.0, 0.74, 0.42), clamp(streak * dash * 0.85, 0.0, 1.0));
  // The beach lamps run down into the water as broken warm lines.
  vec2 q = rioToScene(p);
  if (rioOnBeach(q.x) && mod(s.x + off, 4.0) < 0.5) {
    float run = exp(-k / (0.05 * rioK)) * smoothstep(-0.2, 0.5, rip2);
    col = mix(col, vec3(1.0, 0.72, 0.4), clamp(run * 0.5, 0.0, 0.5));
  }
  return col;
}

vec2 rioCacheUv = vec2(-1.0);
float rioCacheT = -1.0;
vec4 rioCacheValue = vec4(0.0);

vec4 rioScene(vec2 uv, vec2 res, float t) {
  if (uv == rioCacheUv && t == rioCacheT) {
    return rioCacheValue;
  }
  rioT = t;
  rioAspect = res.x / res.y;
  rioSh = 1.0 / res.y;
  rioSw = rioAspect / max(ascii_samples.x, 1.0);
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  float wide = smoothstep(0.8, 1.5, rioAspect);
  // On tall boxes the scene shrinks about the waterline and closes up, so
  // Corcovado and Sugarloaf both stay in view.
  rioK = clamp(rioAspect / 1.45, 0.56, 1.0);
  float rows = rioSh * rioGrid.y;
  // Low on phones, so the peaks rise beside the headline, not behind it.
  rioW = floor(mix(0.16, 0.3, wide) / rows + 0.5) * rows;
  rioSkyScale = mix(0.6, 1.0, wide);
  rioWaterRow = floor(rioW / rioSh + 0.5);
  rioHalf = rioAspect * 0.5 / rioK;
  rioCorX = mix(-0.27, -0.56, wide);
  rioUrcaX = mix(0.08, 0.3, wide);
  rioUrcaR = mix(0.14, 0.2, wide);
  rioLoafX = mix(0.27, 0.6, wide);
  rioSunX = mix(-0.06, -0.12, wide);
  rioBeach0 = -rioHalf - 0.05;
  rioBeach1 = rioUrcaX - rioUrcaR * 0.55;

  vec3 col = s.y < rioWaterRow ? rioWater(s) : rioAbove(s);
  col = clamp(col, 0.0, 1.0);
  // Dot size follows brightness, with a floor so every cell keeps at least
  // a faint dot.
  float luma = dot(col, vec3(0.3, 0.55, 0.15));
  float tone = clamp(0.03 + pow(luma, 0.8), 0.0, 1.0);
  // The dot size already carries the value, so mid-tones are lifted to a
  // clear hue; the darkest stay close to the paper, as quiet dark air.
  float lift = 1.0 / (0.35 + 0.65 * sqrt(max(luma, 0.001)));
  col = clamp(col * mix(1.0, lift, smoothstep(0.06, 0.26, luma)), 0.0, 1.0);
  // Intensity dims colour in step and shrinks the dots more gently, so the
  // shapes keep their place behind text.
  tone *= sqrt(rioIntensity);
  rioCacheUv = uv;
  rioCacheT = t;
  rioCacheValue = vec4(col * rioIntensity, tone);
  return rioCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#0b0a20";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Dots, Braille and quadrants blend neighbouring sizes with ordered
// dithering, so the sky's gradient reads as a smooth halftone.
const DITHER_CHARSETS: ReadonlySet<CharsetName> = new Set<CharsetName>([
  "braille",
  "dots",
  "quadrants",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #15133a 0%, #3c2a5e 30%, #b0587a 52%, #f4a058 66%, #2a2246 70%, #0b0a20 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RioProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The Sugarloaf cable car and its cable. Default `true`. */
  cableCar?: boolean;
  /**
   * Cells as wide as they are tall, so the dots lie in an even lattice.
   * Default `true` for one-glyph charsets such as `dots`; `false` for
   * Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's dusk indigo in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the night blue. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Rio de Janeiro at dusk from the water, painted in dots. Sugarloaf rises
 * as a great dark dome beside Morro da Urca with one cable car crossing
 * between them, Christ the Redeemer stands small and pale on Corcovado,
 * and the lamps of Copacabana curve along the shore under a sky running
 * from gold to violet, all mirrored in the bay. Decorative and full-bleed:
 * size it with `className`, usually `absolute inset-0`.
 */
export const Rio = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  dither,
  square,
  cell = 7,
  stillTime = 12,
  intensity = 1,
  cableCar = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: RioProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rioCableOn: cableCar ? 1 : 0,
        // Samples per glyph, so the waterline lands on whole cells.
        rioGrid: [gx, gy],
        rioIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      dither={
        dither ??
        (DITHER_CHARSETS.has(charset) && !chars ? "blue-noise" : "none")
      }
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      square={square ?? gx * gy === 1}
      cell={cell}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Westminster at dusk, seen across the Thames from the South Bank just
// south of Westminster Bridge. The scene is a 3D model raymarched from a
// camera on the embankment: the Elizabeth Tower, the Palace of Westminster
// receding along the far bank to the Victoria Tower, and the bridge on its
// arches. Units are metres; x runs north along the river, y is up and z
// points west across it, so the camera looks roughly west into the
// afterglow. The water is a plane that traces the mirrored ray through
// slow ripples. Each sample's colour is snapped to the scene's palette and
// its brightness sets the dot size.
const SCENE = `
// The far bank's ground above the water, the palace's river front, the
// Elizabeth Tower's centre and the camera.
const float LD_G = 3.5;
const float LD_ZF = 185.0;
const float LD_TX = 20.0;
const float LD_TZ = 191.7;
const vec3 LD_CAM = vec3(48.0, 7.0, 40.0);
// The bridge's centre line and the spacing of its piers.
const float LD_BX = 66.0;
const float LD_SPAN = 25.4;

float ldT;
float ldPix;
float ldHz;
float ldK;
float ldAsp;
float ldGlowAz;
vec3 ldFw;
vec3 ldRt;
vec3 ldFlood;

float ldHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float ldBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// A square pyramid between heights y0 and y1, half width h0 at the foot
// and h1 at the top.
float ldPyr(vec3 p, float y0, float y1, float h0, float h1) {
  float k = (h0 - h1) / (y1 - y0);
  float side = (max(abs(p.x), abs(p.z)) - (h0 - k * (p.y - y0))) / sqrt(1.0 + k * k);
  return max(side, max(y0 - p.y, p.y - y1));
}

float ldOct(vec2 p) {
  vec2 a = abs(p);
  return max(max(a.x, a.y), (a.x + a.y) * 0.7071);
}

float ldOctPyr(vec3 p, float y0, float y1, float r0, float r1) {
  float k = (r0 - r1) / (y1 - y0);
  float side = (ldOct(p.xz) - (r0 - k * (p.y - y0))) / sqrt(1.0 + k * k);
  return max(side, max(y0 - p.y, p.y - y1));
}

// The Elizabeth Tower, 96 m to the finial, in its own frame: the base's
// centre at the origin. A panelled shaft 12 m square with corner piers,
// the clock stage with a dial on each face, the open belfry, then the iron
// spire with its corner pinnacles and the Ayrton light.
float ldTower(vec3 p) {
  vec2 c = abs(p.xz);
  float d = ldBox(p - vec3(0.0, 25.0, 0.0), vec3(5.6, 25.0, 5.6));
  d = min(d, ldBox(vec3(c.x - 5.4, p.y - 25.0, c.y - 5.4), vec3(0.6, 25.0, 0.6)));
  d = min(d, ldBox(p - vec3(0.0, 56.3, 0.0), vec3(6.3, 6.2, 6.3)));
  // A pointed gable over each dial.
  float gz = max(abs(c.y - 5.8) - 0.5, max((c.x + p.y - 66.8) * 0.7071, 62.5 - p.y));
  float gx = max(abs(c.x - 5.8) - 0.5, max((c.y + p.y - 66.8) * 0.7071, 62.5 - p.y));
  d = min(d, min(gz, gx));
  // The belfry, open in two tall arches on each face.
  float b = ldBox(p - vec3(0.0, 67.6, 0.0), vec3(5.0, 5.1, 5.0));
  float oz = ldBox(vec3(abs(c.x - 2.0), p.y - 67.4, c.y - 5.0), vec3(0.9, 3.7, 1.3));
  float ox = ldBox(vec3(abs(c.y - 2.0), p.y - 67.4, c.x - 5.0), vec3(0.9, 3.7, 1.3));
  d = min(d, max(b, -min(oz, ox)));
  d = min(d, ldBox(p - vec3(0.0, 73.2, 0.0), vec3(5.6, 0.5, 5.6)));
  d = min(d, ldPyr(p, 73.7, 86.0, 5.0, 2.0));
  d = min(d, ldBox(p - vec3(0.0, 87.2, 0.0), vec3(1.9, 1.3, 1.9)));
  d = min(d, ldPyr(p, 88.5, 96.0, 1.75, 0.12));
  d = min(d, ldBox(p - vec3(0.0, 97.3, 0.0), vec3(0.12, 1.3, 0.12)));
  d = min(d, ldPyr(vec3(c.x - 5.0, p.y, c.y - 5.0), 72.6, 81.5, 0.75, 0.06));
  d = min(d, ldPyr(vec3(c.x - 6.0, p.y, c.y - 6.0), 60.0, 66.8, 0.55, 0.05));
  return d;
}

// The palace in river-front coordinates: s metres south of the tower, y
// above the ground, z inland from the front.
vec3 ldPalaceFrame(vec3 p) {
  return vec3((LD_TX - 6.8) - p.x, p.y - LD_G, p.z - LD_ZF);
}

// The river front, 266 m of buttressed gothic wall with four pavilions and
// their corner turrets, under steep slate roofs. Returns the distance and
// whether the nearest part is roof.
vec2 ldFront(vec3 q) {
  float inS = abs(q.x - 133.0) - 133.0;
  float d = ldBox(q - vec3(133.0, 10.0, 45.0), vec3(133.0, 10.0, 45.0));
  // Buttresses every 6.5 m, each ending in a pinnacle above the parapet.
  float sr = mod(q.x, 6.5) - 3.25;
  float bu = ldBox(vec3(sr, q.y - 11.5, q.z + 0.5), vec3(0.6, 11.5, 0.9));
  bu = min(bu, ldPyr(vec3(sr, q.y, q.z + 0.5), 23.0, 27.8, 0.6, 0.05));
  d = min(d, max(bu, inS));
  // Pavilions standing forward of the wall, with square corner turrets.
  float k = clamp(floor((q.x - 11.0) / 81.33 + 0.5), 0.0, 3.0);
  float sc = q.x - 11.0 - 81.33 * k;
  d = min(d, ldBox(vec3(sc, q.y - 12.5, q.z - 8.0), vec3(10.5, 12.5, 11.0)));
  vec3 tq = vec3(abs(sc) - 10.2, q.y, q.z + 2.6);
  d = min(d, ldBox(tq - vec3(0.0, 14.5, 0.0), vec3(1.3, 14.5, 1.3)));
  d = min(d, ldPyr(tq, 29.0, 36.0, 1.4, 0.08));
  // Roofs: one ridge over the river range, a higher one behind, and a hip
  // over each pavilion.
  float roof = max(max(inS, 19.5 - q.y), (abs(q.z - 9.0) + q.y - 28.5) * 0.7071);
  roof = min(roof, max(max(abs(q.x - 133.0) - 118.0, 19.5 - q.y), (abs(q.z - 46.0) + q.y - 32.0) * 0.7071));
  roof = min(roof, ldPyr(vec3(sc, q.y, q.z - 8.0), 25.0, 31.5, 10.5, 2.5));
  // Spirelets along the back ridge.
  float br = mod(q.x, 11.0) - 5.5;
  roof = min(roof, max(ldPyr(vec3(br, q.y, q.z - 46.0), 28.0, 37.0, 0.7, 0.05), abs(q.x - 133.0) - 110.0));
  return roof < d ? vec2(roof, 1.0) : vec2(d, 0.0);
}

// The Central Tower's octagonal lantern and spire, and the Victoria Tower,
// 98.5 m to its corner pinnacles, set back at the far end.
float ldTowers(vec3 q) {
  vec3 cq = vec3(q.x - 133.0, q.y, q.z - 75.0);
  float ct = max(ldOct(cq.xz) - 8.0, max(-q.y, q.y - 57.0));
  ct = min(ct, ldOctPyr(cq, 57.0, 88.0, 8.6, 0.2));
  vec3 vq = vec3(q.x - 260.0, q.y, q.z - 48.0);
  float vt = ldBox(vq - vec3(0.0, 43.0, 0.0), vec3(11.5, 43.0, 11.5));
  vec3 vc = vec3(abs(vq.x) - 10.6, vq.y, abs(vq.z) - 10.6);
  vt = min(vt, max(ldOct(vc.xz) - 2.3, max(-q.y, q.y - 92.0)));
  vt = min(vt, ldOctPyr(vc, 92.0, 99.0, 2.3, 0.1));
  vt = min(vt, ldBox(vq - vec3(0.0, 98.0, 0.0), vec3(0.15, 12.0, 0.15)));
  return min(ct, vt);
}

// Westminster Bridge: seven low arches on stone piers, a parapet each side
// and a lamp standard over every pier.
float ldBridge(vec3 p) {
  vec3 q = vec3(p.x - LD_BX, p.y, p.z);
  float zc = clamp((floor((q.z - 2.0) / LD_SPAN) + 0.5) * LD_SPAN + 2.0, 2.0 + LD_SPAN * 0.5, 2.0 + LD_SPAN * 6.5);
  float body = ldBox(q - vec3(0.0, 4.2, 91.0), vec3(12.5, 4.2, 89.5));
  body = max(body, -(length(vec2((q.z - zc) / 11.0, q.y / 5.9)) - 1.0) * 5.9);
  float par = ldBox(vec3(abs(q.x) - 12.6, q.y - 9.0, q.z - 91.0), vec3(0.35, 0.6, 89.5));
  float pz = floor((q.z - 2.0) / LD_SPAN + 0.5) * LD_SPAN + 2.0;
  float post = ldBox(vec3(abs(q.x) - 12.6, q.y - 11.6, q.z - pz), vec3(0.2, 2.9, 0.2));
  return min(min(body, par), post);
}

// The river cruiser, heading downstream past the palace and under the
// bridge, about 0.8 m/s. It is in view for about four minutes of every
// eight, and mid-river at the default still time.
float ldBoatX() {
  return mod(ldT * 0.8 + 256.0, 400.0) - 320.0;
}

float ldBoat(vec3 p) {
  vec3 q = p - vec3(ldBoatX(), 0.0, 125.0);
  float d = ldBox(q - vec3(0.0, 1.2, 0.0), vec3(15.0, 1.5, 3.0));
  return min(d, ldBox(q - vec3(-1.5, 3.5, 0.0), vec3(10.5, 1.0, 2.5)));
}

// The scene: distance and what was hit. 1 tower, 2 palace stone, 3 roof,
// 4 bridge, 5 bank, 6 the buildings north of the bridge, 7 boat.
vec2 ldMap(vec3 p) {
  // Only the bank's edge is in the distance field; the ground beyond it is
  // a plane that ldTrace meets exactly, since grazing rays would creep.
  vec2 r = vec2(max(max(p.y - LD_G, 181.0 - p.z), p.z - 186.0), 5.0);
  float wall = ldBox(p - vec3(-60.0, LD_G + 0.6, 181.4), vec3(110.0, 0.6, 0.4));
  if (wall < r.x) {
    r = vec2(wall, 5.0);
  }
  vec3 tp = p - vec3(LD_TX, LD_G, LD_TZ);
  if (ldBox(tp - vec3(0.0, 50.0, 0.0), vec3(7.5, 50.0, 7.5)) < r.x) {
    float d = ldTower(tp);
    if (d < r.x) {
      r = vec2(d, 1.0);
    }
  }
  vec3 q = ldPalaceFrame(p);
  if (ldBox(q - vec3(133.0, 19.0, 46.0), vec3(136.0, 19.0, 50.0)) < r.x) {
    vec2 f = ldFront(q);
    if (f.x < r.x) {
      r = vec2(f.x, 2.0 + f.y);
    }
  }
  if (ldBox(q - vec3(196.0, 56.0, 60.0), vec3(78.0, 56.0, 28.0)) < r.x) {
    float d = ldTowers(q);
    if (d < r.x) {
      r = vec2(d, 2.0);
    }
  }
  if (ldBox(p - vec3(LD_BX, 8.0, 91.0), vec3(13.5, 8.0, 90.0)) < r.x) {
    float d = ldBridge(p);
    if (d < r.x) {
      r = vec2(d, 4.0);
    }
  }
  // Portcullis House and its chimneys beyond the bridge.
  float ph = ldBox(p - vec3(106.0, LD_G + 17.0, 205.0), vec3(22.0, 17.0, 19.0));
  if (ph < r.x) {
    ph = ldBox(p - vec3(106.0, LD_G + 13.0, 205.0), vec3(22.0, 13.0, 19.0));
    ph = min(ph, ldBox(vec3(mod(p.x - 84.0, 8.0) - 4.0, p.y - LD_G - 30.0, abs(p.z - 205.0) - 16.0), vec3(1.2, 4.0, 1.2)));
    ph = max(ph, abs(p.x - 106.0) - 22.0);
    if (ph < r.x) {
      r = vec2(ph, 6.0);
    }
  }
  if (ldBoatOn > 0.5 && ldBox(p - vec3(ldBoatX(), 2.5, 125.0), vec3(16.0, 3.0, 4.0)) < r.x) {
    float d = ldBoat(p);
    if (d < r.x) {
      r = vec2(d, 7.0);
    }
  }
  return r;
}

// March until the ray comes within a cell's footprint of a surface, so
// thin parts such as the spire and the pinnacles still cover a dot.
float ldTrace(vec3 ro, vec3 rd, float tmax, float steps, out float id) {
  float t = 0.5;
  id = 0.0;
  // Rays already above the tallest roof by the far bank miss everything.
  if (rd.y > 0.0 && rd.z > 0.0 && ro.y + rd.y * (181.0 - ro.z) / rd.z > 112.0) {
    return -1.0;
  }
  if (rd.y < 0.0 && ro.y > LD_G) {
    float tg = (LD_G - ro.y) / rd.y;
    if (ro.z + rd.z * tg > 186.0) {
      tmax = min(tmax, tg);
      id = 5.0;
    }
  }
  float ground = id;
  id = 0.0;
  for (int i = 0; i < 120; i++) {
    if (float(i) >= steps) {
      break;
    }
    vec3 p = ro + rd * t;
    vec2 h = ldMap(p);
    if (h.x < ldPix * t * 0.45 + 0.01) {
      id = h.y;
      return t;
    }
    // Never less than a quarter of the cell's footprint, so rays grazing a
    // long wall don't creep along it.
    t += max(h.x * 0.92, ldPix * t * 0.25);
    if (t > tmax || (rd.y > 0.0 && p.y > 112.0)) {
      break;
    }
  }
  if (ground > 0.0) {
    id = ground;
    return tmax;
  }
  return -1.0;
}

vec3 ldNormal(vec3 p, float e) {
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * ldMap(p + k.xyy * e).x + k.yyx * ldMap(p + k.yyx * e).x
    + k.yxy * ldMap(p + k.yxy * e).x + k.xxx * ldMap(p + k.xxx * e).x);
}

// Soft shadow toward the floodlights, so buttresses, turrets and the
// tower's piers throw their shade across the stone.
float ldShadow(vec3 p) {
  float s = 1.0;
  float t = 0.4;
  for (int i = 0; i < 16; i++) {
    float h = ldMap(p + ldFlood * t).x;
    s = min(s, 6.0 * h / t);
    t += clamp(h, 0.3, 3.0);
    if (s < 0.02 || t > 12.0) {
      break;
    }
  }
  return clamp(s, 0.0, 1.0);
}

float ldOcclusion(vec3 p, vec3 n) {
  float o = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.5 * float(i);
    o += (h - ldMap(p + n * h).x) * w;
    w *= 0.6;
  }
  return clamp(1.0 - o * 0.45, 0.25, 1.0);
}

// The dusk: pale gold low in the west behind the palace, rose, then slate
// blue overhead. The glow sits a little left of the tower.
vec3 ldSky(vec3 rd) {
  float h = max(rd.y, 0.0);
  float g = atan(rd.x, rd.z) - ldGlowAz;
  vec3 c = mix(vec3(0.98, 0.79, 0.55), vec3(0.66, 0.5, 0.56), smoothstep(0.0, 0.8, abs(g)));
  c = mix(c, vec3(0.80, 0.60, 0.58), smoothstep(0.04, 0.13, h));
  c = mix(c, vec3(0.44, 0.42, 0.58), smoothstep(0.1, 0.24, h));
  c = mix(c, vec3(0.20, 0.24, 0.42), smoothstep(0.2, 0.42, h));
  c = mix(c, vec3(0.09, 0.11, 0.23), smoothstep(0.4, 0.7, h));
  float gd = length(vec2(g * 0.7, h * 2.2));
  c += vec3(1.0, 0.72, 0.42) * (exp(-gd / 0.1) * 0.22 + exp(-gd / 0.32) * 0.14);
  return c;
}

// Thin layers of cloud low in the sky, lit from below by the afterglow.
vec3 ldClouds(vec3 rd, vec3 c) {
  float h = max(rd.y, 0.0);
  float az = atan(rd.x, rd.z);
  float band = smoothstep(0.03, 0.08, h) * smoothstep(0.36, 0.16, h);
  if (band <= 0.0) {
    return c;
  }
  float n = fbm(vec2(az * 5.0 + ldT * 0.004, log(h + 0.02) * 3.2));
  float k = smoothstep(0.56, 0.76, n) * band;
  float warm = exp(-abs(az - ldGlowAz) / 0.6) * smoothstep(0.3, 0.06, h);
  vec3 lit = mix(vec3(0.46, 0.40, 0.56), vec3(1.0, 0.70, 0.52), warm);
  return mix(c, lit, k * 0.55);
}

// A far city low on the horizon wherever the model is open to the sky.
float ldSkyline(vec3 rd) {
  float az = atan(rd.x, rd.z);
  float blk = ldHash(vec2(floor(az * 70.0), 3.0));
  float north = smoothstep(-0.05, 0.1, az);
  float spire = step(0.93, ldHash(vec2(floor(az * 220.0), 5.0))) * north * 0.03;
  return 0.004 + (0.012 + 0.03 * north) * blk * blk + (0.006 + 0.012 * north) * fbm(vec2(az * 8.0, 1.7)) + spire;
}

// One light seen along a ray: a hard core and a soft halo, hidden when the
// ray stops in front of it.
float ldPoint(vec3 ro, vec3 rd, vec3 l, float tEnd, float size) {
  vec3 v = l - ro;
  float tp = dot(v, rd);
  if (tp <= 0.0 || tp > tEnd + 1.5) {
    return 0.0;
  }
  float d = length(v - rd * tp);
  float a = d / tp;
  // At least half a cell across, so far lamps still land on a dot.
  float core = clamp(size / tp, ldPix * 0.55, ldPix * 0.9);
  return exp(-pow(a / core, 2.0)) + exp(-a / (ldPix * 1.6)) * 0.14 + exp(-a / (ldPix * 6.0)) * 0.025;
}

vec3 ldLamps(vec3 ro, vec3 rd, float tEnd) {
  float breathe = 0.92 + 0.08 * sin(ldT * 0.7);
  float g = 0.0;
  for (int k = 0; k < 8; k++) {
    float z = 2.0 + LD_SPAN * float(k);
    g += ldPoint(ro, rd, vec3(LD_BX - 12.6, 14.6, z), tEnd, 0.7);
    g += ldPoint(ro, rd, vec3(LD_BX + 12.6, 14.6, z), tEnd, 0.7) * 0.45;
  }
  // Lamps every 16 m along the palace's river wall: only the two nearest
  // the ray's closest pass along the wall can show.
  vec3 w = ro - vec3(0.0, LD_G + 2.2, 180.6);
  float tl = -dot(w.yz, rd.yz) / max(dot(rd.yz, rd.yz), 1e-4);
  float lx = (ro.x + rd.x * tl) / 16.0;
  for (int k = 0; k < 2; k++) {
    float x = (floor(lx) + float(k)) * 16.0;
    if (x < -245.0 || x > 12.0) {
      continue;
    }
    g += ldPoint(ro, rd, vec3(x, LD_G + 2.2, 180.6), tEnd, 0.5) * 0.7;
  }
  // Capped, so a cluster of near lanterns stays gold points, not a white blob.
  vec3 c = vec3(1.0, 0.8, 0.5) * min(g, 1.0) * breathe;
  // The lit dials and the Ayrton light warm the air around them.
  float dial = ldPoint(ro, rd, vec3(LD_TX, LD_G + 56.3, LD_TZ - 6.4), tEnd + 2.0, 0.01);
  dial += ldPoint(ro, rd, vec3(LD_TX + 6.4, LD_G + 56.3, LD_TZ), tEnd + 2.0, 0.01);
  c += vec3(1.0, 0.8, 0.5) * dial * 0.55 * (0.95 + 0.05 * sin(ldT * 0.4));
  c += vec3(1.0, 0.9, 0.7) * ldPoint(ro, rd, vec3(LD_TX, LD_G + 87.2, LD_TZ), tEnd + 2.0, 0.9) * 0.25;
  if (ldBoatOn > 0.5) {
    c += vec3(1.0, 0.95, 0.85) * ldPoint(ro, rd, vec3(ldBoatX() + 8.0, 6.5, 125.0), tEnd, 0.35) * 0.7;
  }
  return c;
}

// Whether a window in a grid is lit: most stay as they are, a few change
// every minute or so.
float ldLit(vec2 id, float odds) {
  float h = ldHash(id);
  float era = floor(ldT / 47.0 + h * 9.0);
  float flip = step(0.93, ldHash(id + era * 7.31));
  return abs(step(odds, h) - flip);
}

// A soft band from a to b, widened by the footprint so a row of windows
// thinner than a cell reads as a dimmer line, not as noise.
float ldBand(float x, float a, float b, float fp) {
  return smoothstep(a - fp, a + fp, x) * (1.0 - smoothstep(b - fp, b + fp, x));
}

vec3 ldSurface(vec3 p, vec3 rd, float t, float id, bool primary) {
  vec3 n = id > 4.5 && id < 5.5 && p.z > 186.2 ? vec3(0.0, 1.0, 0.0) : ldNormal(p, max(0.02, t * ldPix * 0.25));
  float fp = t * ldPix * 0.5;
  // The main floods shine from the south-east; weaker ones from the
  // north-east keep the north faces from going black.
  float dif = max(dot(n, ldFlood), 0.0);
  float fill = max(dot(n, normalize(vec3(0.7, -0.1, -0.7))), 0.0) * 0.32;
  float sh = 1.0;
  float ao = 1.0;
  if (primary) {
    if (dif > 0.0 && id < 5.5) {
      sh = ldShadow(p + n * 0.15);
    }
    ao = ldOcclusion(p, n);
  }
  vec3 amb = mix(vec3(0.07, 0.07, 0.13), vec3(0.20, 0.22, 0.36), n.y * 0.5 + 0.5);
  vec3 stoneLit = vec3(1.0, 0.70, 0.38);
  vec3 col;
  float y = p.y - LD_G;
  if (id < 1.5) {
    // The tower: stone up to the belfry, slate and gilding on the spire.
    vec3 tp = p - vec3(LD_TX, LD_G, LD_TZ);
    bool front = abs(n.z) > abs(n.x);
    float u = front ? tp.x : tp.z;
    float face = front ? -tp.z : tp.x;
    float flood = (dif * sh + fill) * mix(1.15, 0.8, smoothstep(0.0, 90.0, tp.y));
    vec3 base = vec3(0.92, 0.80, 0.62);
    if (tp.y < 50.0) {
      // Vertical panelling with a string course every 6 m.
      float panel = 0.8 + 0.2 * cos(u * 6.2832 / 2.4);
      float course = 1.0 - 0.3 * ldBand(mod(tp.y, 6.0), 0.0, 0.5, fp * 0.5);
      base *= panel * course;
      float win = ldBand(abs(u), 0.0, 0.55, fp * 0.4) * ldBand(mod(tp.y, 6.0), 2.0, 4.2, fp * 0.4);
      float on = ldLit(vec2(floor(tp.y / 6.0), front ? 1.0 : 2.0), 0.6);
      col = base * (stoneLit * flood * 0.95 + amb) * ao;
      col = mix(col, mix(vec3(0.08, 0.07, 0.1), vec3(1.0, 0.78, 0.45), on), win * 0.8);
    } else if (tp.y < 62.5) {
      float r = length(vec2(u, tp.y - 56.3));
      float onFace = step(6.15, face);
      // Gilded surround, then the opal dial with its dark rim and hands.
      col = vec3(1.0, 0.82, 0.5) * (stoneLit * flood * 1.05 + amb) * ao;
      if (onFace > 0.5 && r < 3.7) {
        // Real time: the minute hand turns once an hour.
        float ang = ldT * 0.000145 + 1.1;
        vec2 dp = vec2(u * (front ? 1.0 : -1.0), tp.y - 56.3);
        vec2 mh = vec2(sin(ang * 12.0), cos(ang * 12.0));
        vec2 hh = vec2(sin(ang), cos(ang));
        float hm = abs(dp.x * mh.y - dp.y * mh.x) + max(-dot(dp, mh), 0.0) + max(dot(dp, mh) - 3.0, 0.0);
        float hr = abs(dp.x * hh.y - dp.y * hh.x) + max(-dot(dp, hh), 0.0) + max(dot(dp, hh) - 2.0, 0.0);
        float hand = max(smoothstep(0.3 + fp, 0.3 - fp, hm), smoothstep(0.35 + fp, 0.35 - fp, hr));
        float rim = smoothstep(3.0 - fp, 3.2, r);
        vec3 opal = vec3(1.0, 0.93, 0.72) * (1.25 - 0.25 * r / 3.7);
        col = mix(opal, vec3(0.18, 0.13, 0.1), max(rim, hand * clamp(0.5 / fp, 0.3, 0.8)));
      }
    } else if (tp.y < 73.7) {
      col = base * (stoneLit * flood + amb) * ao;
      // Inside the belfry's arches the bells are lit.
      if (face < 4.7 && abs(n.y) < 0.5) {
        col = vec3(0.9, 0.55, 0.26) * 0.75;
      }
    } else {
      bool lantern = tp.y > 85.9 && tp.y < 88.5;
      float gild = ldBand(mod(tp.y - 73.7, 3.2), 0.0, 0.6, fp * 0.5);
      vec3 slate = mix(vec3(0.16, 0.19, 0.26), vec3(0.95, 0.72, 0.38), gild * 0.7);
      col = slate * (stoneLit * flood * 0.9 + amb * 1.2);
      if (lantern) {
        col = vec3(1.0, 0.9, 0.7);
      }
    }
  } else if (id < 2.5) {
    // Palace stone, floodlit from the river, with rows of lit windows
    // between the buttresses.
    vec3 q = ldPalaceFrame(p);
    float flood = (dif * sh + fill * 1.4) * mix(1.12, 0.78, smoothstep(0.0, 30.0, q.y));
    // Warmer and deeper low down where the floods are close, paler above.
    vec3 stone = mix(vec3(0.95, 0.7, 0.5), vec3(0.9, 0.82, 0.68), smoothstep(4.0, 26.0, q.y));
    col = stone * (stoneLit * flood + amb) * ao;
    if (n.z < -0.7 && q.y < 21.0) {
      float sr = abs(mod(q.x, 6.5) - 3.25);
      float colm = ldBand(sr, 1.15, 2.55, fp * 0.5);
      float row = floor(q.y / 5.5);
      float rowm = ldBand(mod(q.y, 5.5), 1.4, 4.4, fp * 0.5) * step(0.5, row);
      float on = ldLit(vec2(floor(q.x / 3.25), row), 0.42);
      vec3 glass = mix(col * vec3(0.4, 0.33, 0.3), vec3(1.0, 0.94, 0.78) * 1.2, on);
      col = mix(col, glass, colm * rowm * 0.8);
    }
  } else if (id < 3.5) {
    // Slate roofs, cool from the sky with a little light from below.
    col = vec3(0.16, 0.17, 0.24) * (stoneLit * dif * sh * 0.5 + amb * 1.6) * ao;
  } else if (id < 4.5) {
    // The bridge, painted green, lit by its own lamps.
    float pz = floor((p.z - 2.0) / LD_SPAN + 0.5) * LD_SPAN + 2.0;
    float lamp = 1.0 / (1.0 + pow(length(vec2(p.z - pz, (p.y - 14.0) * 1.4)) / 6.0, 2.0));
    vec3 green = vec3(0.3, 0.56, 0.44);
    col = green * (amb * 1.8 + vec3(1.0, 0.8, 0.55) * (lamp * 1.1 + 0.16)) * ao;
    if (p.y > 9.7) {
      // The lamp standards are dark iron under their lanterns.
      col = green * amb * 0.8;
    } else if (p.y > 8.3) {
      col += vec3(0.5, 0.36, 0.2) * lamp;
    }
    if (p.y < 5.9 && n.y < 0.2 && abs(p.x - LD_BX) < 12.0) {
      col *= 0.35;
    }
  } else if (id < 5.5) {
    // The bank and its wall in dark granite, warmed a little by the floods.
    col = vec3(0.2, 0.19, 0.22) * (amb + stoneLit * 0.18) * ao;
  } else if (id < 6.5) {
    float win = ldBand(mod(p.x, 3.0), 0.8, 2.2, fp * 0.5) * ldBand(mod(p.y, 3.6), 1.0, 2.6, fp * 0.5);
    float on = ldLit(floor(vec2(p.x / 3.0, p.y / 3.6)), 0.7);
    col = vec3(0.18, 0.18, 0.26) * (amb * 1.3) + vec3(1.0, 0.82, 0.55) * win * on * 0.5;
  } else {
    // The cruiser: a pale hull and a row of lit cabin windows.
    float bx = p.x - ldBoatX();
    col = vec3(0.6, 0.6, 0.7) * (amb * 1.4);
    if (p.y > 3.0 && p.y < 4.3 && abs(bx + 1.5) < 10.0) {
      col = mix(col, vec3(1.0, 0.8, 0.5), 0.85 * ldBand(mod(bx, 1.8), 0.4, 1.4, fp * 0.5));
    }
  }
  return col;
}

// Distance haze toward the horizon's colour in that direction, and the
// low river mist.
vec3 ldAir(vec3 col, vec3 rd, float t, float hy) {
  vec3 horizon = ldSky(vec3(rd.x, 0.012, rd.z)) * 0.85;
  float haze = 1.0 - exp(-t * (0.0007 + 0.0011 * ldFog));
  col = mix(col, horizon, haze);
  float drift = fbm(vec2(atan(rd.x, rd.z) * 9.0 + ldT * 0.01, hy * 0.06 - ldT * 0.004));
  float mist = ldFog * 0.4 * (1.0 - exp(-t / 300.0)) * exp(-max(hy, 0.0) / 7.0) * (0.25 + 0.9 * drift);
  return mix(col, horizon * vec3(0.92, 0.9, 1.0), clamp(mist, 0.0, 0.6));
}

vec3 ldOpen(vec3 rd) {
  vec3 c = ldClouds(rd, ldSky(rd));
  if (rd.y < ldSkyline(rd)) {
    vec3 far = ldSky(vec3(rd.x, 0.02, rd.z)) * vec3(0.5, 0.48, 0.6);
    vec2 w = floor(vec2(atan(rd.x, rd.z) * 500.0, rd.y * 500.0));
    far += vec3(1.0, 0.8, 0.5) * step(0.9, ldHash(w)) * 0.3;
    c = far;
  }
  return c;
}

void ldSetup(vec2 res, float t) {
  ldT = t;
  ldAsp = res.x / res.y;
  float wide = smoothstep(0.6, 1.6, ldAsp);
  // A normal lens on wide boxes; tall ones widen the view so the tower and
  // the near palace still fit across.
  ldK = max(0.98, 0.58 / ldAsp);
  ldPix = ldK / ascii_samples.y;
  ldHz = mix(0.31, 0.235, wide);
  // Turn the camera so the tower stands at the same place in every box.
  float towerX = mix(0.62, 0.71, wide);
  float az = atan(LD_TX - LD_CAM.x, LD_TZ - LD_CAM.z);
  float yaw = az - atan((towerX - 0.5) * ldAsp * ldK);
  ldFw = vec3(sin(yaw), 0.0, cos(yaw));
  ldRt = vec3(cos(yaw), 0.0, -sin(yaw));
  ldGlowAz = az - 0.42;
  ldFlood = normalize(vec3(-0.42, -0.1, -0.9));
}

vec3 ldRadiance(vec2 uv) {
  vec3 rd = normalize(ldFw + ldRt * (uv.x - 0.5) * ldAsp * ldK + vec3(0.0, 1.0, 0.0) * (uv.y - ldHz) * ldK);
  float tw = rd.y < 0.0 ? -LD_CAM.y / rd.y : 1e5;
  float id;
  float th = ldTrace(LD_CAM, rd, min(tw, 1800.0), 110.0, id);
  vec3 col;
  float tEnd;
  if (th > 0.0) {
    vec3 p = LD_CAM + rd * th;
    col = ldAir(ldSurface(p, rd, th, id, true), rd, th, p.y);
    tEnd = th;
  } else if (tw < 1e4) {
    // The Thames: the mirrored ray, tipped by slow ripples, gives back a
    // darker, cooler copy of the scene above.
    vec3 p = LD_CAM + rd * tw;
    float near = 1.0 - smoothstep(30.0, 180.0, tw);
    float r1 = snoise(vec2(p.x * 0.035 + ldT * 0.02, p.z * 0.2 - ldT * 0.32));
    float r2 = snoise(vec2(p.x * 0.09 - ldT * 0.03, p.z * 0.55 + ldT * 0.45));
    vec3 n = normalize(vec3((r1 * 0.7 + r2 * 0.6) * 0.03, 1.0, (r1 + r2 * 0.7) * mix(0.012, 0.035, near)));
    vec3 rr = reflect(rd, n);
    rr.y = max(rr.y, 0.003);
    rr = normalize(rr);
    float rid;
    float rt = ldTrace(p, rr, 1800.0, 80.0, rid);
    vec3 refl;
    if (rt > 0.0) {
      vec3 q = p + rr * rt;
      refl = ldAir(ldSurface(q, rr, rt + tw, rid, false), rr, rt, q.y);
    } else {
      refl = ldOpen(rr);
    }
    refl += ldLamps(p, rr, rt > 0.0 ? rt : 1e5);
    float fres = 0.32 + 0.68 * pow(1.0 - max(-rd.y, 0.0), 4.0);
    vec3 deep = vec3(0.025, 0.04, 0.07);
    col = mix(deep, refl * vec3(0.7, 0.72, 0.82), clamp(fres, 0.0, 0.8));
    col = ldAir(col, rd, tw, 0.0);
    tEnd = tw;
  } else {
    col = ldOpen(rd);
    tEnd = 1e5;
  }
  return col + ldLamps(LD_CAM, rd, tEnd);
}
`;

// The scene's palette, dark to light within each family: night slate,
// dusk rose, low gold, floodlit stone, stone in shadow, the clock's opal,
// the river and the bridge's green. Every dot takes the nearest one.
const PALETTE = [
  "#0a0f1e",
  "#10172b",
  "#161f39",
  "#1d2848",
  "#253257",
  "#2f3d67",
  "#3b4a78",
  "#4a5888",
  "#5c6896",
  "#6e78a2",
  "#6c6488",
  "#84708f",
  "#9c7c92",
  "#b68a94",
  "#cc9a92",
  "#dcae8c",
  "#e9c094",
  "#f3d3a2",
  "#f8e2b8",
  "#fdf0d4",
  "#ffd27a",
  "#f6c46a",
  "#eaa94e",
  "#d18f3e",
  "#b07534",
  "#8a5c30",
  "#644530",
  "#45332c",
  "#2c2a42",
  "#3b3650",
  "#4c4560",
  "#5e536a",
  "#fff4d6",
  "#ffe6a8",
  "#fff8ea",
  "#08121c",
  "#0f1f2e",
  "#16293a",
  "#20364a",
  "#1d3a33",
  "#2a5245",
  "#3b6b58",
  "#232838",
  "#2f3446",
] as const satisfies readonly `#${string}`[];

const glslColor = (hex: string) => {
  const channel = (at: number) =>
    (Number.parseInt(hex.slice(at, at + 2), 16) / 255).toFixed(4);
  return `vec3(${channel(1)}, ${channel(3)}, ${channel(5)})`;
};

// Unrolled, since GLSL ES 1.00 has no constant arrays.
const QUANTIZE = `
vec3 ldQuant(vec3 c) {
  vec3 best = c;
  float bd = 1e9;
  vec3 e;
  float d;
${PALETTE.map(
  (hex) => `  e = c - ${glslColor(hex)};
  d = dot(e * e, vec3(0.3, 0.5, 0.2));
  if (d < bd) {
    bd = d;
    best = ${glslColor(hex)};
  }`
).join("\n")}
  return best;
}
`;

const SHADE = `${SCENE}${QUANTIZE}
vec2 ldCacheUv = vec2(-1.0);
float ldCacheT = -1.0;
vec4 ldCacheValue = vec4(0.0);

// Brightness sets the dot size, from a fine speck in the darkest sky to a
// full dot on the lit stone; the colour is lifted so small dots keep their
// hue, then snapped to the palette.
vec4 ldShade(vec2 uv, vec2 res, float t) {
  if (uv == ldCacheUv && t == ldCacheT) {
    return ldCacheValue;
  }
  ldSetup(res, t);
  vec3 c = max(ldRadiance(uv), 0.0);
  // A few stars in the dark top of the sky.
  vec2 cell = floor(uv * ascii_samples);
  if (uv.y > ldHz + 0.33 && ldHash(cell + 17.0) > 0.995) {
    float tw = 0.6 + 0.4 * sin(t * (0.8 + ldHash(cell) * 1.6) + ldHash(cell + 3.0) * 6.28);
    c = max(c, vec3(0.85, 0.88, 1.0) * tw * smoothstep(ldHz + 0.33, ldHz + 0.5, uv.y));
  }
  float peak = max(max(c.r, c.g), c.b);
  float tone = 0.13 + 0.87 * pow(clamp(peak, 0.0, 1.0), 1.1);
  vec3 hue = c / pow(max(peak, 0.05), 0.35);
  vec3 q = ldQuant(clamp(hue, 0.0, 1.0));
  ldCacheUv = uv;
  ldCacheT = t;
  ldCacheValue = vec4(q * ldIntensity, tone * sqrt(ldIntensity));
  return ldCacheValue;
}
`;

const FIELD = `${SHADE}
float field(vec2 uv, vec2 res, float t) {
  return ldShade(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SHADE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return ldShade(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#0a0f1e";
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
        "linear-gradient(to bottom, #10172b 0%, #253257 30%, #6c6488 55%, #dcae8c 68%, #2c2a42 72%, #10172b 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface LondonProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** How much haze and river mist hang over the scene, from 0 (clear) to 1. Default 0.5. */
  fog?: number;
  /** The river cruiser heading downstream. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /**
   * Cells as wide as they are tall, so the dots lie in an even lattice.
   * Default `true` for one-glyph charsets such as `dots`; `false` for
   * Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`. */
  ramp?: AsciiSceneProps["ramp"];
  /** Ordered dithering between dot sizes, so the sky's gradient reads as a smooth halftone. Default `"bayer4"` for ramp charsets. */
  dither?: AsciiSceneProps["dither"];
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Westminster at dusk across the Thames, modelled in 3D and painted in
 * dots. The floodlit Elizabeth Tower with its glowing clock faces stands
 * beside Westminster Bridge, the Palace of Westminster recedes along the
 * river to the Victoria Tower, and the Thames mirrors it all through slow
 * ripples under a sky from pale gold to slate blue. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const London = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  dither,
  square,
  fps = 24,
  stillTime = 30,
  intensity = 1,
  fog = 0.5,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: LondonProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const resolved = resolveCharset(charset, chars);
  const isRamp = resolved.kind === "ramp";
  const [gridX, gridY] = resolved.grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        ldBoatOn: boat ? 1 : 0,
        ldFog: clamp(fog, 0, 1),
        ldIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      dither={dither ?? (isRamp ? "bayer4" : "none")}
      square={square ?? gridX * gridY === 1}
      fps={fps}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};

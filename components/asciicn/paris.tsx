"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Paris at blue hour, built in 3D and printed in dots. The camera stands on a
// landing at the water's edge, three metres above the Seine, looking
// downstream. The river runs along +z between stone quays 150 m apart; the
// Eiffel Tower stands on the right bank about 900 m away, with rows of
// Haussmann blocks along both quays. Every sample raymarches the scene (signed
// distances in metres), shades what it hits with the sky, the street lamps and
// the tower's own gold light, and if it lands on the water traces the mirrored
// ray back into the scene. Distance hazes everything towards the sky. The
// colour then snaps to a palette of 40 hand-picked colours and its brightness
// sets the dot size.
const SCENE = `
const float PARIS_RIVER = 75.0;
const float PARIS_QUAY = 8.0;
const float PARIS_LOW = 1.6;
const float PARIS_WALL = 87.0;
const float PARIS_EYE = 3.0;
const float PARIS_CAM_X = -66.0;
const float PARIS_TAN = 0.42;
const float PARIS_SHIFT = 0.42;
const vec3 PARIS_TOWER = vec3(172.0, 8.0, 700.0);
const float PARIS_FAR = 4000.0;

// Set once per sample by parisScene.
float parisT;
float parisPix;
vec3 parisCam;

float parisHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float parisBox2(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float parisBox3(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// ---------------------------------------------------------------- the tower
// Half the tower's width at height h above its ground, fitted to the real
// thing: 62.5 m at the feet, 35.3 m at the first floor (57.6 m), 20.5 m at the
// second (115.7 m) and about 7 m under the top floor (276 m).
float parisHalf(float h) {
  return 4.5 + 58.0 * exp(-h / 91.0);
}

// The width of one leg: 25 m square at the foot, about 13 m where the four
// legs meet at the second floor.
float parisLeg(float h) {
  return 9.0 + 16.0 * exp(-h / 80.0);
}

float parisTower(vec3 p) {
  vec3 l = p - PARIS_TOWER;
  float bound = parisBox3(l - vec3(0.0, 166.0, 0.0), vec3(66.0, 168.0, 66.0));
  if (bound > 6.0) {
    return bound;
  }
  // The tower is the same on all four faces and either side of each
  // diagonal, so fold the point into one eighth of it.
  vec2 q = abs(l.xz);
  float a = max(q.x, q.y);
  float b = min(q.x, q.y);
  float h = l.y;
  float w = parisHalf(max(h, 0.0));
  float d;
  if (h < 116.0) {
    float leg = parisLeg(h);
    d = parisBox2(vec2(a, b) - (w - 0.5 * leg), vec2(0.5 * leg));
  } else {
    d = max(a - w, h - 276.0);
  }
  d = max(d, -h) * 0.8;
  // The great arch on each face, springing low from the legs and touching
  // the girder under the first floor.
  float e = length(vec2(b / 38.0, (h - 6.0) / 45.0));
  float arch = max(max(abs(e - 1.0) * 38.0 - 2.2, abs(a - 45.0) - 1.6), 6.0 - h);
  d = min(d, arch);
  // The three floors, the campanile and the antenna.
  d = min(d, parisBox2(vec2(a, h - 57.0), vec2(37.0, 5.0)));
  d = min(d, parisBox2(vec2(a, h - 115.5), vec2(22.0, 3.5)));
  d = min(d, parisBox2(vec2(a, h - 276.5), vec2(9.5, 4.0)));
  d = min(d, parisBox2(vec2(a, h - 290.0), vec2(5.5 - (h - 280.0) * 0.15, 10.0)));
  d = min(d, parisBox2(vec2(a, h - 314.0), vec2(1.4, 16.0)));
  return d;
}

// ---------------------------------------------------------------- the quays
float parisLand(vec3 p) {
  float right = max(PARIS_RIVER - p.x, p.y - PARIS_QUAY);
  float low = max(p.x + PARIS_RIVER, p.y - PARIS_LOW);
  float high = max(p.x + PARIS_WALL, p.y - PARIS_QUAY);
  return min(right, min(low, high));
}

// ------------------------------------------------------------ the buildings
// Facade line and depth of each row, in metres from the river's middle.
const float PARIS_ROW_R = 104.0;
const float PARIS_ROW_L = 118.0;
const float PARIS_DEPTH = 16.0;
const float PARIS_LOT = 20.0;

// Cornice height of lot c on one side (0 for a cross street or the open
// ground around the tower), in metres above the quay.
float parisCornice(float c, float side) {
  if (mod(c, 7.0) < 0.5 || c < -3.0) {
    return 0.0;
  }
  if (side > 0.0 && c > 14.0 && c < 52.0) {
    return 0.0;
  }
  return 16.0 + 8.0 * parisHash(vec2(c, side * 3.1));
}

// One lot: the stone block, its mansard roof and a chimney stack on the
// party wall. u is the depth from the facade, w the distance along the quay
// from the lot's start, y the height above the quay.
float parisLot(float u, float y, float w, float c, float side) {
  float h = parisCornice(c, side);
  if (h < 0.5) {
    return 1e3;
  }
  vec3 local = vec3(u - 0.5 * PARIS_DEPTH, y, w - 0.5 * PARIS_LOT);
  float block = parisBox3(local - vec3(0.0, 0.5 * h, 0.0), vec3(0.5 * PARIS_DEPTH, 0.5 * h, 0.5 * PARIS_LOT - 0.05));
  // The mansard: a steep face, about 70 degrees, front and back, then flat.
  float r = y - h;
  float roof = max(parisBox3(local - vec3(0.0, h + 2.75, 0.0), vec3(0.5 * PARIS_DEPTH, 2.75, 0.5 * PARIS_LOT - 0.05)),
    (r - 2.75 * (0.5 * PARIS_DEPTH - abs(local.x) - 0.4)) / 2.93);
  float d = min(block, roof);
  if (parisHash(vec2(c, side + 5.3)) > 0.15) {
    d = min(d, parisBox3(vec3(local.x + 1.0, y - h - 6.0, w - 0.7), vec3(3.2, 1.6 + 0.6 * parisHash(vec2(c, side)), 0.7)));
  }
  return d;
}

float parisRow(vec3 p, float side) {
  float face = side > 0.0 ? PARIS_ROW_R : PARIS_ROW_L;
  float u = side * p.x - face;
  float y = p.y - PARIS_QUAY;
  float bound = parisBox2(vec2(u - 0.5 * PARIS_DEPTH, y - 16.0), vec2(0.5 * PARIS_DEPTH, 16.0));
  if (bound > 3.0) {
    return bound;
  }
  float c = floor(p.z / PARIS_LOT);
  float w = p.z - c * PARIS_LOT;
  // Neighbouring lots differ in height, so test them too.
  float d = parisLot(u, y, w, c, side);
  d = min(d, parisLot(u, y, w + PARIS_LOT, c - 1.0, side));
  d = min(d, parisLot(u, y, w - PARIS_LOT, c + 1.0, side));
  return d;
}

// ---------------------------------------------------------------- the trees
// Plane trees along the top of both quays, and a grove either side of the
// tower's feet on the Champ de Mars.
float parisCrowns(vec3 p, float x, float spacing, float size) {
  float k = floor(p.z / spacing + 0.5);
  float dz = p.z - k * spacing;
  float s = size * (0.85 + 0.3 * parisHash(vec2(k, x)));
  vec3 r = vec3(p.x - x, p.y - PARIS_QUAY - 6.0 - s * 0.7, dz);
  float d = (length(r / vec3(s * 0.8, s * 0.75, s)) - 1.0) * s * 0.7;
  return d;
}

float parisTrees(vec3 p) {
  float bound = abs(p.x - 89.0) - 8.0;
  bound = max(bound, p.y - PARIS_QUAY - 22.0);
  float grove = parisBox3(p - vec3(PARIS_TOWER.x, PARIS_QUAY + 8.0, PARIS_TOWER.z), vec3(110.0, 8.0, 260.0));
  if (min(bound, grove) > 3.0) {
    return min(max(bound, 0.0) + 3.0, grove);
  }
  float d = max(parisCrowns(p, 89.0, 9.0, 6.5), 280.0 - p.z);
  if (grove < 3.0) {
    // Rows of trees along the sides of the lawn, clear of the tower's legs.
    float lane = abs(p.x - PARIS_TOWER.x);
    float rowX = lane < 95.0 ? 85.0 : 105.0;
    vec3 g = vec3(PARIS_TOWER.x + sign(p.x - PARIS_TOWER.x) * rowX, p.y, p.z);
    float clear = 70.0 - length(p.xz - PARIS_TOWER.xz);
    d = min(d, max(parisCrowns(vec3(p.x - g.x + 89.0, p.y, p.z), 89.0, 10.0, 6.0), clear));
  }
  return d;
}

// ----------------------------------------------------------------- the boat
// A bateau-mouche coming upstream, towards the camera, at walking pace.
vec3 parisBoatAt() {
  float z = 1500.0 - mod(parisT * 4.0, 1420.0);
  return vec3(18.0, 0.0, z);
}

float parisBoat(vec3 p) {
  if (parisBoatOn < 0.5) {
    return 1e3;
  }
  vec3 l = p - parisBoatAt();
  float hull = parisBox3(l - vec3(0.0, 1.0, 0.0), vec3(4.5, 1.2, 30.0));
  float cabin = parisBox3(l - vec3(0.0, 3.4, 2.0), vec3(3.8, 1.3, 22.0));
  return min(hull, cabin);
}

// ---------------------------------------------------------------- the bridge
// The Pont d'Iena, which crosses to the tower's feet: five stone arches
// with a lamp over each pier.
const float PARIS_BRIDGE = 640.0;

float parisBridge(vec3 p) {
  vec3 l = p - vec3(0.0, 0.0, PARIS_BRIDGE);
  float bound = parisBox3(l - vec3(0.0, 6.0, 0.0), vec3(92.0, 7.0, 9.0));
  if (bound > 2.0) {
    return bound;
  }
  float body = parisBox3(l - vec3(0.0, 5.5, 0.0), vec3(90.0, 5.5, 8.0));
  // Five arch openings, 30 m across and 7 m high.
  float xc = clamp(floor(l.x / 35.0 + 0.5), -2.0, 2.0) * 35.0;
  float opening = (length(vec2((l.x - xc) / 14.5, (l.y + 0.5) / 7.5)) - 1.0) * 7.5;
  body = max(body, -max(opening, abs(l.z) - 9.0));
  float parapet = parisBox3(l - vec3(0.0, 11.6, 0.0), vec3(90.0, 0.6, 7.6));
  parapet = max(parapet, -parisBox3(l - vec3(0.0, 11.6, 0.0), vec3(91.0, 1.0, 7.0)));
  return min(body, parapet);
}

float parisMap(vec3 p) {
  float d = parisLand(p);
  d = min(d, parisBridge(p));
  d = min(d, parisTower(p));
  d = min(d, parisRow(p, 1.0));
  d = min(d, parisRow(p, -1.0));
  d = min(d, parisTrees(p));
  d = min(d, parisBoat(p));
  return d;
}

// Which surface p lies on: 1 quay, 2 tower, 3 buildings, 4 trees, 5 boat.
float parisMaterial(vec3 p) {
  float best = parisLand(p);
  float id = 1.0;
  float d = parisTower(p);
  if (d < best) {
    best = d;
    id = 2.0;
  }
  d = min(parisRow(p, 1.0), parisRow(p, -1.0));
  if (d < best) {
    best = d;
    id = 3.0;
  }
  d = parisTrees(p);
  if (d < best) {
    best = d;
    id = 4.0;
  }
  d = parisBridge(p);
  if (d < best) {
    best = d;
    id = 1.0;
  }
  if (parisBoat(p) < best) {
    id = 5.0;
  }
  return id;
}

// Distance along the ray to the first surface, or -1 for none before tMax.
float parisMarch(vec3 ro, vec3 rd, float tMax) {
  // Rising rays leave the city above its roofs, or above the tower if they
  // pass through its bounding box, so most of the sky costs a few steps.
  if (rd.y > 0.0) {
    vec3 inv = 1.0 / rd;
    vec3 lo = (PARIS_TOWER - vec3(66.0, 0.0, 66.0) - ro) * inv;
    vec3 hi = (PARIS_TOWER + vec3(66.0, 332.0, 66.0) - ro) * inv;
    vec3 near = min(lo, hi);
    vec3 far = max(lo, hi);
    bool tower = max(near.x, max(near.y, near.z)) < min(far.x, min(far.y, far.z));
    tMax = min(tMax, ((tower ? 342.0 : 46.0) - ro.y) / rd.y);
  }
  float t = 0.5;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = parisMap(p);
    // Far off, a hit only needs to be good to a fraction of a sample.
    if (d < 0.002 * t + 0.02) {
      return t;
    }
    t += d * 0.9;
    if (t > tMax) {
      return -1.0;
    }
  }
  return t < tMax ? t : -1.0;
}

vec3 parisNormal(vec3 p, float t) {
  vec2 e = vec2(1.0, -1.0) * max(0.03, t * 0.0012);
  return normalize(e.xyy * parisMap(p + e.xyy) + e.yyx * parisMap(p + e.yyx) + e.yxy * parisMap(p + e.yxy) + e.xxx * parisMap(p + e.xxx));
}

// ------------------------------------------------------------------ the sky
// Blue hour with no sunset colour: a luminous cobalt at the horizon, paler
// where the sun went down ahead and to the left, deepening to ink overhead.
vec3 parisSky(vec3 rd) {
  float e = max(rd.y, 0.0);
  vec3 col = mix(vec3(0.26, 0.38, 0.8), vec3(0.13, 0.22, 0.6), smoothstep(0.0, 0.1, e));
  col = mix(col, vec3(0.06, 0.1, 0.32), smoothstep(0.08, 0.3, e));
  col = mix(col, vec3(0.025, 0.035, 0.13), smoothstep(0.25, 0.6, e));
  float west = max(dot(normalize(rd.xz), normalize(vec2(-0.45, 1.0))), 0.0);
  col += vec3(0.16, 0.22, 0.3) * pow(west, 6.0) * exp(-e * 9.0);
  // Long thin clouds, lit faintly from below by the city, drifting slowly.
  vec2 cp = rd.xz / max(rd.y + 0.04, 0.04);
  float cloud = fbm(vec2(cp.x * 0.35 + parisT * 0.004, cp.y * 0.06));
  cloud = smoothstep(0.52, 0.75, cloud) * smoothstep(0.06, 0.14, e) * (1.0 - smoothstep(0.3, 0.55, e));
  col = mix(col, vec3(0.22, 0.28, 0.5), cloud * 0.6);
  return col;
}

// The tower's glow in the air: light scattered by the haze, strongest around
// the second floor and fading out towards the top.
float parisHalo(vec3 ro, vec3 rd, float tHit) {
  vec2 c = PARIS_TOWER.xz;
  vec2 d2 = rd.xz;
  float k = dot(d2, d2);
  float tc = max(dot(c - ro.xz, d2) / max(k, 1e-5), 0.0);
  float side = length(ro.xz + d2 * tc - c);
  float y = ro.y + rd.y * tc - PARIS_TOWER.y;
  float reach = parisHalf(clamp(y, 0.0, 300.0)) + 20.0;
  float across = max(side - reach * 0.6, 0.0) / 110.0;
  float up = (y - 120.0) / 170.0;
  float glow = exp(-across * across - up * up);
  // Whatever stands well in front of the tower hides its glow.
  return glow * smoothstep(tc - 260.0, tc - 40.0, tHit);
}

// The beacon in the lantern on top, which swells slowly as it turns to face
// you, about every eleven seconds.
float parisBeacon(vec3 ro, vec3 rd, float tHit) {
  vec3 c = PARIS_TOWER + vec3(0.0, 300.0, 0.0);
  float tc = dot(c - ro, rd);
  if (tHit > 0.0 && tHit < tc - 30.0) {
    return 0.0;
  }
  float ang = length(ro + rd * tc - c) / max(tc, 1.0);
  float turn = 0.5 + 0.5 * cos(parisT * 0.55);
  return parisBeaconOn * (0.35 + 0.65 * turn * turn) * exp(-ang / 0.006);
}

// Street lamps along the top of both quays: warm heads on cast-iron posts.
vec3 parisLamps(vec3 ro, vec3 rd, float tHit) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    // Two rows along the quays, one along the bridge's parapet.
    float x = i == 0 ? 78.0 : -89.0;
    float t = i == 2 ? (PARIS_BRIDGE - 8.0 - ro.z) / rd.z : (x - ro.x) / rd.x;
    if (t > 1.0 && (tHit < 0.0 || t < tHit + 2.0)) {
      vec3 q = ro + rd * t;
      float sp = i == 2 ? 35.0 : 26.0;
      float along = i == 2 ? q.x + 17.5 : q.z + 13.0;
      float dz = (mod(along, sp) - 0.5 * sp) * max(abs(i == 2 ? rd.z : rd.x), 0.05);
      if (i == 2 && abs(q.x) > 88.0) {
        dz = 1e3;
      }
      float dy = q.y - (i == 2 ? 15.5 : PARIS_QUAY + 4.5);
      float ang = length(vec2(dy, dz)) / t;
      float near = smoothstep(2200.0, 600.0, t);
      sum += vec3(1.0, 0.8, 0.55) * near * (exp(-ang / 0.0025) * 0.9 + exp(-ang / 0.012) * 0.12);
    }
  }
  return sum;
}

// Most windows keep their state. One in four turns on or off every few
// minutes, fading over three seconds, so the city changes slowly.
float parisLit(vec2 id, float chance) {
  if (parisHash(id) > 0.25) {
    return step(1.0 - chance, parisHash(id + 7.1));
  }
  float period = 90.0 + 120.0 * parisHash(id + 3.3);
  float phase = parisT / period + parisHash(id + 5.5);
  float k = floor(phase);
  float now = step(1.0 - chance, parisHash(id + k * 1.37));
  float before = step(1.0 - chance, parisHash(id + (k - 1.0) * 1.37));
  return mix(before, now, smoothstep(0.0, 3.0 / period, fract(phase)));
}

// How much of a pattern with this period survives at the sample's footprint:
// 1 when it is several samples wide, 0 when it falls between samples.
float parisDetail(float period, float t) {
  return smoothstep(1.2, 3.0, period / max(t * parisPix, 1e-4));
}

// The sky's light on a surface, and the low warm light of the street lamps.
vec3 parisAmbient(vec3 n, float y) {
  vec3 sky = mix(vec3(0.12, 0.15, 0.28), vec3(0.34, 0.42, 0.72), 0.5 + 0.5 * n.y);
  float west = max(dot(n, normalize(vec3(-0.45, 0.25, 1.0))), 0.0);
  sky += vec3(0.12, 0.17, 0.3) * west;
  float lamp = exp(-max(y - PARIS_QUAY, 0.0) / 9.0) * smoothstep(-0.2, 0.6, -n.y + 0.6);
  return sky + vec3(0.42, 0.32, 0.2) * lamp;
}

vec3 parisGold(float h) {
  return mix(vec3(1.0, 0.5, 0.14), vec3(1.0, 0.78, 0.42), smoothstep(20.0, 280.0, h));
}

// The tower lit from within by its sodium lamps: every face glows gold, the
// faces turned towards you brightest, those turned away and the insides of
// the legs deeper and redder. Floors and edges catch the most light.
vec3 parisShadeTower(vec3 p, vec3 n, vec3 rd, float t, out float density) {
  vec3 l = p - PARIS_TOWER;
  float h = l.y;
  vec3 gold = parisGold(h);
  float facing = max(dot(n, -rd), 0.0);
  // The lamps favour the front, so the face turned to the river falls
  // into a deeper amber and the tower reads as a solid with two sides.
  float river = smoothstep(0.3, 0.8, -n.x);
  float under = max(-n.y, 0.0);
  float light = (0.5 + 0.5 * facing) * mix(1.0, 0.5, river) - 0.25 * under;
  // Iron seen through the openings, on the far side of the tower or facing
  // in towards its middle, sits in shadow, so the arches and the gaps
  // between the legs open up.
  vec2 q = abs(l.xz);
  float a = max(q.x, q.y);
  vec2 view = normalize(PARIS_TOWER.xz - parisCam.xz);
  float rear = smoothstep(-0.25, 0.45, dot(l.xz, view) / max(length(l.xz), 1.0));
  float inward = smoothstep(0.1, 0.6, -dot(n.xz, l.xz) / max(length(l.xz), 1.0));
  light *= mix(1.0, 0.32, max(rear * step(h, 150.0), inward));
  // The corner posts of each leg catch the most light.
  float w = parisHalf(max(h, 0.0));
  float leg = parisLeg(h);
  float b0 = min(q.x, q.y);
  float post = min(min(abs(a - w), abs(b0 - w)), min(abs(a - w + leg), abs(b0 - w + leg)));
  light *= 1.0 + 0.5 * (1.0 - smoothstep(1.5, 3.5, post)) * step(h, 116.0);
  // The lattice: diagonal bracing across each face, in bays a few metres
  // square, which the eye reads as lit iron and dark gaps.
  // Where the real bays fall between samples they are drawn at the finest
  // size the dots can hold, so the iron always reads as a lattice.
  float b = min(q.x, q.y);
  float bay = max(h < 116.0 ? 10.0 : 7.0, 2.6 * t * parisPix);
  float brace = min(abs(fract((b + h) / bay) - 0.5), abs(fract((b - h) / bay) - 0.5));
  float iron = 1.0 - smoothstep(0.1, 0.22, brace);
  light *= mix(0.62, 1.12, iron);
  // The lattice is open: what lies behind shows through the gaps, most of
  // all through the far side of the tower.
  density = mix(mix(0.62, 1.0, iron), mix(0.18, 0.5, iron), rear);
  density = max(density, step(abs(h - 57.0), 5.0) + step(abs(h - 115.5), 3.5) + step(h, 2.0));
  // Floors burn brighter.
  float floors = max(max(step(abs(h - 57.0), 5.0), step(abs(h - 115.5), 3.5)), step(abs(h - 276.5), 4.0));
  vec3 col = gold * light * 1.15;
  // The floors are lit hardest of all, a paler gold right round the tower.
  return mix(col, vec3(1.0, 0.86, 0.6) * 1.5, floors * 0.85);
}

// Pale limestone facades in the blue light, rows of tall windows, some lit
// warm, under grey-blue zinc mansards with dormers and chimney stacks.
vec3 parisShadeBuilding(vec3 p, vec3 n, vec3 rd, float t) {
  float side = p.x > 0.0 ? 1.0 : -1.0;
  float face = side > 0.0 ? PARIS_ROW_R : PARIS_ROW_L;
  float u = side * p.x - face;
  float y = p.y - PARIS_QUAY;
  float c = floor(p.z / PARIS_LOT);
  float h = parisCornice(c, side);
  // The lot this point belongs to, which may be the neighbour's.
  float w = p.z - c * PARIS_LOT;
  if (h < 0.5 || y > h + 8.0) {
    float cn = w < 10.0 ? c - 1.0 : c + 1.0;
    h = max(parisCornice(cn, side), 0.5);
    c = cn;
  }
  vec3 amb = parisAmbient(n, p.y);
  float tint = parisHash(vec2(c, side + 9.0));
  vec3 stone = mix(vec3(0.74, 0.7, 0.64), vec3(0.86, 0.8, 0.7), tint);
  vec3 zinc = vec3(0.17, 0.21, 0.31);
  if (y > h + 6.2) {
    // A chimney stack.
    return vec3(0.42, 0.4, 0.42) * amb * 1.2;
  }
  if (y > h - 0.2 || n.y > 0.3) {
    // The mansard: zinc, its steep face pierced by a row of dormers.
    vec3 col = zinc * amb;
    float along = p.z;
    float dormer = step(abs(mod(along, 3.4) - 1.7), 0.55) * step(abs(y - h - 2.0), 0.9) * step(n.y, 0.6);
    float on = parisLit(vec2(floor(along / 3.4), c * 3.0 + 77.0), 0.22);
    float k = parisDetail(3.4, t);
    vec3 glass = mix(vec3(0.05, 0.06, 0.12), vec3(1.0, 0.72, 0.38), on);
    col = mix(col, glass, dormer * mix(on * 0.25, 1.0, k));
    // The ridge catches the open sky.
    col += vec3(0.14, 0.18, 0.3) * smoothstep(0.6, 0.95, n.y) * step(h + 5.0, y);
    // A pale cornice line along the foot of the roof.
    col = mix(col, stone * vec3(0.45, 0.47, 0.58), step(y, h + 0.6) * step(-0.2, n.y));
    return col;
  }
  // Stone takes the open sky over the river and, low down, the warm light
  // of the street lamps, so the facades stand pale against the blue.
  // The left bank faces away from the afterglow and stands in cooler shade.
  float lampLit = exp(-y / 9.0);
  float shade = side > 0.0 ? 1.0 : 0.8;
  vec3 col = stone * ((vec3(0.28, 0.31, 0.43) + vec3(0.14, 0.17, 0.26) * max(dot(n, normalize(vec3(-0.45, 0.25, 1.0))), 0.0)) * shade + vec3(0.46, 0.34, 0.2) * lampLit);
  if (abs(n.x) > 0.7) {
    // Seen along the quay a window bay shrinks, so judge its detail by its
    // foreshortened width.
    float squeeze = sqrt(max(1.0 - rd.z * rd.z, 0.0));
    // The facade: a ground floor of shops, a cornice, and in between five
    // floors of windows, 3.3 m apart, with the long balconies of the second
    // and fifth floors.
    float along = p.z;
    float col3 = floor(along / 3.3);
    float fx = abs(mod(along, 3.3) - 1.65);
    float storey = floor((y - 4.6) / 3.1);
    float fy = mod(y - 4.6, 3.1);
    // Floors resolve long before the bays along them do: the window rows
    // then read as bands of glass that run towards the vanishing point.
    float kv = parisDetail(3.1, t);
    float kh = parisDetail(3.3 * squeeze, t);
    if (y < 4.2) {
      float shop = parisLit(vec2(col3, c + 31.0), 0.45);
      vec3 window = mix(vec3(0.08, 0.07, 0.1), vec3(1.0, 0.76, 0.46), shop);
      col = mix(col, window, step(0.6, y) * mix(0.45, step(fx, 1.25) * 0.9, kh));
    } else if (y < h - 1.0) {
      float band = mix(0.5, step(0.5, fy) * step(fy, 2.6), kv);
      float pane = band * mix(0.7, step(fx, 0.62), kh);
      float chance = mix(0.05, 0.3, step(0.6, parisHash(vec2(c, storey + 13.0))));
      float on = parisLit(vec2(col3, storey + c * 11.0), chance);
      vec3 lit = parisHash(vec2(col3, storey + 4.0)) > 0.75 ? vec3(0.95, 0.9, 0.8) : vec3(1.0, 0.7, 0.36);
      vec3 glass = mix(vec3(0.07, 0.08, 0.14), lit, on);
      // A lit window keeps its light even when it is smaller than a sample.
      col = mix(col, glass, max(pane, on * 0.5 * band));
      // A pale string course under every floor, iron balconies on the
      // second and fifth.
      col *= 1.0 + 0.35 * kv * step(2.7, fy);
      float balcony = (abs(storey - 1.0) < 0.5 || abs(storey - 4.0) < 0.5) ? step(fy, 0.4) : 0.0;
      col = mix(col, vec3(0.08, 0.09, 0.15), balcony * kv * 0.85);
    } else {
      col *= 1.15;
    }
  }
  return col;
}

vec3 parisShade(vec3 ro, vec3 rd, float t, bool primary) {
  vec3 p = ro + rd * t;
  vec3 n = parisNormal(p, t);
  float id = parisMaterial(p);
  vec3 col;
  if (id < 1.5) {
    // Stone quay walls, darker towards the water, with a pale coping.
    vec3 amb = parisAmbient(n, p.y);
    float coping = smoothstep(PARIS_QUAY - 0.8, PARIS_QUAY - 0.4, p.y);
    float courses = parisDetail(0.6, t) * 0.12 * step(0.5, mod(p.y, 0.6) / 0.6);
    col = vec3(0.4, 0.4, 0.42) * amb * (0.55 + 0.3 * smoothstep(0.0, PARIS_QUAY, p.y) - courses);
    col += vec3(0.1, 0.11, 0.17) * coping;
    // Lamp light pooled on the wall under each lamp.
    float lz = abs(mod(p.z + 13.0, 26.0) - 13.0);
    col += vec3(0.4, 0.27, 0.12) * exp(-lz / 4.0) * smoothstep(2.0, PARIS_QUAY, p.y) * 0.3;
  } else if (id < 2.5) {
    float density;
    col = parisShadeTower(p, n, rd, t, density);
    col = mix(parisSky(rd), col, clamp(density, 0.0, 1.0));
  } else if (id < 3.5) {
    col = parisShadeBuilding(p, n, rd, t);
  } else if (id < 4.5) {
    // Plane trees: dark blue-green, lit warm from beneath by the lamps and
    // gold on the side facing the tower.
    vec3 amb = parisAmbient(n, p.y - 4.0);
    col = vec3(0.16, 0.24, 0.24) * amb;
    float leaves = parisHash(floor(p.xz * 0.6) + floor(p.y * 0.6));
    col *= 0.75 + 0.5 * leaves * parisDetail(2.0, t);
    vec3 toTower = PARIS_TOWER + vec3(0.0, 60.0, 0.0) - p;
    float dist = length(toTower);
    col += vec3(0.7, 0.38, 0.1) * max(dot(n, toTower / dist), 0.0) * 30.0 / (30.0 + dist * dist / 900.0);
  } else {
    // The boat: a pale hull and a long glass cabin lit warm.
    vec3 l = p - parisBoatAt();
    float cabin = step(2.2, l.y) * step(l.y, 4.4);
    float mullion = step(0.35, abs(mod(l.z, 2.4) - 1.2));
    col = mix(vec3(0.5, 0.52, 0.62) * parisAmbient(n, p.y) * 1.6, vec3(1.0, 0.86, 0.62), cabin * mix(0.6, mullion, parisDetail(2.4, t)));
  }
  return col;
}

// ---------------------------------------------------------------- the water
vec3 parisRipple(vec3 p, float t) {
  // Long, low swells across the river, finer and fainter with distance, so
  // far off they only break the reflections into horizontal dashes.
  float far = 1.0 / (1.0 + t / 250.0);
  vec2 q = p.xz * vec2(0.05, 0.16) * mix(0.35, 1.0, far);
  float a = snoise(q + vec2(parisT * 0.03, -parisT * 0.22));
  float b = snoise(q * 2.3 + vec2(-parisT * 0.05, parisT * 0.31) + 4.7);
  float slope = (a * 0.7 + b * 0.45) * mix(0.05, 0.16, far * far);
  return normalize(vec3(slope * 0.3, 1.0, slope));
}

// The colour along one ray: whatever it hits, the sky beyond, the haze in
// between and the glows it passes. Water rays go round once more.
vec3 parisTrace(vec3 ro, vec3 rd, out float tHit, bool primary) {
  float tWater = rd.y < 0.0 ? (0.0 - ro.y) / rd.y : PARIS_FAR;
  float t = parisMarch(ro, rd, min(tWater, PARIS_FAR));
  tHit = t;
  vec3 col;
  if (t > 0.0) {
    col = parisShade(ro, rd, t, primary);
  } else if (rd.y < 0.0) {
    tHit = tWater;
    col = vec3(0.0);
  } else {
    col = parisSky(rd);
    tHit = -1.0;
  }
  // Haze thickens with distance towards the sky at the horizon.
  float dist = tHit < 0.0 ? PARIS_FAR : tHit;
  vec3 haze = parisSky(vec3(rd.x, 0.02, rd.z)) * 0.95;
  col = mix(col, haze, (1.0 - exp(-dist / 2600.0)) * step(0.0, tHit));
  float halo = parisHalo(ro, rd, tHit < 0.0 ? 1e5 : tHit);
  col += vec3(0.75, 0.4, 0.13) * halo * 0.38;
  col += vec3(1.0, 0.9, 0.7) * parisBeacon(ro, rd, tHit);
  col += parisLamps(ro, rd, tHit);
  return col;
}

vec3 parisWater(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = parisRipple(p, t);
  vec3 r = reflect(rd, n);
  r.y = max(r.y, 0.002);
  float hit;
  vec3 refl = parisTrace(p + vec3(0.0, 0.05, 0.0), r, hit, false);
  float fresnel = 0.5 + 0.45 * pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
  vec3 deep = vec3(0.015, 0.025, 0.06);
  vec3 col = deep + refl * fresnel * vec3(0.82, 0.88, 1.0);
  vec3 haze = parisSky(vec3(rd.x, 0.02, rd.z)) * 0.95;
  return mix(col, haze, 1.0 - exp(-t / 2600.0));
}

// ------------------------------------------------------------- the palette
// Five families of eight colours each: the night blues of sky and water, the
// limestone, the zinc, the tower's gold and the warm light of windows and
// lamps. Every sample snaps to the nearest, which reads as a print rather
// than a gradient.
vec3 parisRamp(vec3 a, vec3 b, vec3 c, vec3 d, float k) {
  float s = k * 3.0;
  if (s < 1.0) {
    return mix(a, b, s);
  }
  if (s < 2.0) {
    return mix(b, c, s - 1.0);
  }
  return mix(c, d, s - 2.0);
}

vec3 parisFamily(int f, float k) {
  if (f == 0) {
    return parisRamp(vec3(0.05, 0.07, 0.19), vec3(0.11, 0.18, 0.46), vec3(0.24, 0.39, 0.84), vec3(0.64, 0.75, 1.0), k);
  }
  if (f == 1) {
    return parisRamp(vec3(0.14, 0.15, 0.25), vec3(0.37, 0.38, 0.5), vec3(0.64, 0.63, 0.68), vec3(0.9, 0.86, 0.8), k);
  }
  if (f == 2) {
    return parisRamp(vec3(0.1, 0.15, 0.23), vec3(0.2, 0.3, 0.42), vec3(0.4, 0.5, 0.66), vec3(0.68, 0.76, 0.88), k);
  }
  if (f == 3) {
    return parisRamp(vec3(0.42, 0.16, 0.05), vec3(0.78, 0.36, 0.08), vec3(0.98, 0.6, 0.2), vec3(1.0, 0.86, 0.56), k);
  }
  return parisRamp(vec3(0.5, 0.3, 0.16), vec3(0.86, 0.56, 0.28), vec3(1.0, 0.8, 0.54), vec3(1.0, 0.95, 0.86), k);
}

vec3 parisQuantize(vec3 c) {
  vec3 best = c;
  float bd = 1e9;
  for (int f = 0; f < 5; f++) {
    for (int j = 0; j < 8; j++) {
      vec3 p = parisFamily(f, float(j) / 7.0);
      vec3 d = p - c;
      float e = dot(d * d, vec3(0.3, 0.5, 0.2));
      if (e < bd) {
        bd = e;
        best = p;
      }
    }
  }
  return best;
}

vec2 parisCacheUv = vec2(-1.0);
float parisCacheT = -1.0;
vec4 parisCacheValue = vec4(0.0);

vec4 parisScene(vec2 uv, vec2 res, float t) {
  if (uv == parisCacheUv && t == parisCacheT) {
    return parisCacheValue;
  }
  parisT = t;
  float aspect = res.x / res.y;
  parisPix = 2.0 * PARIS_TAN / res.y;
  // A level camera with a shifted lens, so verticals stay vertical and the
  // horizon sits a third of the way up. It turns so the tower lands right of
  // centre on wide boxes, leaving the middle for a headline, and in the
  // middle on tall ones.
  vec3 ro = vec3(PARIS_CAM_X, PARIS_EYE, 0.0);
  parisCam = ro;
  vec2 toTower = PARIS_TOWER.xz - ro.xz;
  float bearing = atan(toTower.x, toTower.y);
  float place = aspect * mix(0.0, 0.4, smoothstep(0.95, 1.4, aspect));
  float yaw = bearing - atan(place * PARIS_TAN);
  vec3 fwd = vec3(sin(yaw), 0.0, cos(yaw));
  vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
  vec2 s = vec2((uv.x - 0.5) * 2.0 * aspect, (uv.y - 0.5) * 2.0 + PARIS_SHIFT);
  vec3 rd = normalize(fwd + (right * s.x + vec3(0.0, 1.0, 0.0) * s.y) * PARIS_TAN);

  float tHit;
  vec3 col = parisTrace(ro, rd, tHit, true);
  if (rd.y < 0.0 && tHit > 0.0 && abs(ro.y + rd.y * tHit) < 0.01) {
    col = parisWater(ro, rd, tHit);
  }
  if (tHit < 0.0) {
    // Stars, few and faint, only where the sky is dark.
    vec2 cellId = floor(uv * res);
    float star = parisHash(cellId + 17.0);
    float density = 0.004 * smoothstep(0.18, 0.45, rd.y);
    if (star > 1.0 - density) {
      float twinkle = 0.5 + 0.5 * sin(parisT * (0.4 + star * 0.5) + parisHash(cellId + 3.0) * 40.0);
      col = max(col, mix(vec3(0.45, 0.52, 0.8), vec3(0.85, 0.88, 1.0), twinkle));
    }
  }

  // Dot size follows brightness; even the darkest sky keeps a faint screen.
  float peak = max(max(col.r, col.g), max(col.b, 1e-4));
  float bright = dot(col, vec3(0.28, 0.55, 0.17));
  float tone = 0.1 + 0.9 * pow(clamp(bright * 1.25, 0.0, 1.0), 0.8);
  // Each dot is drawn in its full hue, darkened a little when it is small,
  // then snapped to the palette.
  vec3 hue = clamp(col / peak, 0.0, 1.0) * mix(0.45, 1.0, smoothstep(0.03, 0.5, peak));
  vec3 ink = parisQuantize(hue);

  parisCacheUv = uv;
  parisCacheT = t;
  parisCacheValue = vec4(ink * parisIntensity, clamp(tone, 0.0, 1.0) * sqrt(parisIntensity));
  return parisCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#060a1f";
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
        "linear-gradient(to bottom, #060a1e 0%, #0d1a4a 40%, #22408c 62%, #3a5cb0 66%, #0a1028 68%, #050817 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface ParisProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The slow glow of the beacon on top of the tower. Default `true`. */
  beacon?: boolean;
  /** The bateau-mouche coming up the river. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: a deep night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Cells as wide as they are tall, so the dots lie in an even lattice. Default `true` for ramp charsets, `false` for Braille and quadrants. */
  square?: boolean;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the night blue. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the blue hour as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Paris at a clear blue hour, built in 3D and printed in dots. From the
 * water's edge the Seine runs away between stone quays and Haussmann blocks
 * towards the Eiffel Tower, lit gold from within, the one warm light under a
 * cobalt sky, mirrored and broken by slow ripples. Decorative and full-bleed:
 * size it with `className`, usually `absolute inset-0`.
 */
export const Paris = ({
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
  stillTime = 300,
  intensity = 1,
  beacon = true,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: ParisProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  // Dithering blends dot sizes into smooth gradients on ramps; Braille and
  // quadrants would turn it into an even mesh, so they keep the threshold.
  const isRamp = resolveCharset(charset, chars).kind === "ramp";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        parisBeaconOn: beacon ? 1 : 0,
        parisBoatOn: boat ? 1 : 0,
        parisIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      dither={dither ?? (isRamp ? "bayer4" : "none")}
      square={square ?? isRamp}
      fps={fps}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};

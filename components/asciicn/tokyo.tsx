"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Tokyo at night from a rooftop in the east of the city, looking west.
// The scene is built in 3D and raymarched from a camera 118 m up:
//
// - The city is a grid of lots, each with a box building (and sometimes a
//   crown on top), walked front to back with a 2D DDA so every facade, roof
//   and street is a real surface at a real distance. Past a few kilometres
//   the walk switches to long steps, so the city carries on to the horizon.
// - Light is a low moon in the west (it lights roofs and west-facing walls),
//   cool sky light from above, warm street light from below, and emission:
//   windows by floor and bay, shopfronts, vertical neon signs on the near
//   streets and red aircraft lights on the tall roofs.
// - Haze thickens with distance and settles low, so far blocks fade into
//   the glow over the city.
// - The Tokyo Skytree, Tokyo Tower and Mount Fuji are surfaces of
//   revolution or profiles placed at their distance (1.5 km, 6.5 km and
//   90 km) and drawn to their real proportions.
//
// Each sample's colour is then snapped to a 46-colour palette, and dot
// size follows its brightness through ordered dithering, like a print.
// Landmarks are placed by where they should land on screen for the box's
// aspect, so the Skytree stays right of a centred headline on a wide
// screen and in view on a phone.
const SCENE = `
const float TK_CAM = 64.0;
const float TK_LOT = 38.0;
const float TK_HORIZON = 0.36;

vec2 tkCacheUv = vec2(-1.0);
float tkCacheT = -1.0;
vec4 tkCacheValue = vec4(0.0);

// Tangent of one cell, so a distance times it is one cell's size there.
float tkPix;
float tkTime;
vec3 tkMoon;
// Where the landmarks stand: x across, z ahead, in metres.
vec2 tkSkytreeAt;
vec2 tkTowerAt;
float tkFujiTan;
float tkFujiPeak;
vec2 tkCellIndex;

float tkNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// The night sky toward direction rd: pale cyan-grey where the city's light
// catches the haze at the horizon, teal above it, deepening to near black.
vec3 tkSky(vec3 rd) {
  float s = clamp(rd.y / 0.5, 0.0, 1.0);
  // The glow over a city of millions reaches well up the sky.
  vec3 c = mix(vec3(0.3, 0.46, 0.48), vec3(0.18, 0.33, 0.37), smoothstep(0.0, 0.05, s));
  c = mix(c, vec3(0.11, 0.23, 0.28), smoothstep(0.04, 0.4, s));
  c = mix(c, vec3(0.045, 0.1, 0.14), smoothstep(0.35, 1.0, s));
  // The low moon's glow.
  float m = max(dot(rd, tkMoon), 0.0);
  c += vec3(0.32, 0.42, 0.46) * (exp((m - 1.0) * 900.0) * 0.5 + exp((m - 1.0) * 70.0) * 0.18);
  return c;
}

// The haze colour along rd: the horizon glow, a little darker looking down.
vec3 tkHaze(vec3 rd) {
  vec3 c = tkSky(vec3(rd.x, max(rd.y, 0.0) * 0.6, rd.z));
  return c * mix(1.0, 0.82, smoothstep(0.0, -0.12, rd.y));
}

// The street grid runs at an angle to the view, so each block shows two
// faces and the avenues converge on two vanishing points, one of them
// near the Skytree.
const float TK_GRID_C = 0.9287;
const float TK_GRID_S = 0.3709;

vec2 tkToGrid(vec2 v) {
  return vec2(v.x * TK_GRID_C - v.y * TK_GRID_S, v.x * TK_GRID_S + v.y * TK_GRID_C);
}

vec2 tkToCam(vec2 v) {
  return vec2(v.x * TK_GRID_C + v.y * TK_GRID_S, -v.x * TK_GRID_S + v.y * TK_GRID_C);
}

// One lot of the city: height of the main block (0 for open ground), the
// height of a crown on top of it, and a seed for its looks.
vec3 tkLot(vec2 id) {
  // The lot's centre as seen from the camera: x across, y ahead.
  vec2 c = tkToCam((id + 0.5) * TK_LOT);
  // Avenues every few blocks, and a few open lots.
  if (mod(id.x, 7.0) < 0.5 || mod(id.y, 6.0) < 0.5 || hash21(id + 9.9) < 0.05) {
    return vec3(0.0);
  }
  float r1 = hash21(id + vec2(3.7, 1.9));
  float r2 = hash21(id + vec2(8.3, 5.1));
  float district = smoothstep(0.5, 0.82, tkNoise(id * 0.05 + 3.0));
  float h = 8.0 + 30.0 * r1 * r1 + 18.0 * district * r1;
  float crown = 0.0;
  if (r2 < 0.035 + 0.24 * district) {
    h = 55.0 + 150.0 * pow(hash21(id + 2.2), 1.6) * (0.55 + 0.45 * district);
    crown = hash21(id + 4.4) > 0.4 ? 6.0 + 14.0 * hash21(id + 5.5) : 0.0;
  }
  // The camera's own roof and the blocks just below it.
  if (c.y < 150.0) {
    return vec3(0.0);
  }
  // Keep the near foreground below the frame's middle, and the far city
  // a low band at the horizon, lowest where Fuji rises behind it.
  // Towers may stand close at the sides, framing the view.
  float side = smoothstep(0.42, 0.5, abs(c.x) / c.y) * step(c.y, 900.0);
  if (side > 0.5 && r2 < 0.3) {
    h = 70.0 + 90.0 * hash21(id + 2.2);
  }
  h = min(h, mix(30.0 + c.y * 0.09, 1e4, side));
  // Clusters of towers break the skyline away from the middle of the
  // frame, where a headline sits; the framing towers at the sides stay.
  float bearing = abs(c.x) / c.y;
  float skyline = mix(0.022, 0.06 * district, smoothstep(0.18, 0.28, bearing));
  h = min(h, mix(TK_CAM + c.y * max(skyline, 0.022), 1e4, side));
  float fujiOff = abs(c.x / c.y - tkFujiTan);
  h = min(h, mix(TK_CAM - 24.0 + c.y * 0.002, 1e4, smoothstep(0.12, 0.22, fujiOff)));
  // Nothing tall between the camera and the Skytree's lower shaft, and
  // the low streets of Oshiage round its foot.
  vec2 toS = tkSkytreeAt;
  float along = dot(c, toS) / dot(toS, toS);
  float off = length(c - toS * clamp(along, 0.0, 1.0));
  if (along > 0.0 && along < 1.0 && off < 70.0 + 30.0 * along) {
    h = min(h, mix(80.0, 40.0, along));
    crown = 0.0;
  }
  if (length(c - tkSkytreeAt) < 110.0) {
    h = min(h, 22.0);
    crown = 0.0;
  }
  // Tokyo Tower's line of sight keeps only its foot hidden.
  vec2 toT = tkTowerAt;
  float alongT = dot(c, toT) / dot(toT, toT);
  float offT = length(c - toT * clamp(alongT, 0.0, 1.0));
  if (alongT > 0.0 && alongT < 1.0 && offT < 40.0 + 90.0 * alongT) {
    h = min(h, 30.0);
    crown = 0.0;
  }
  return vec3(h, crown, hash21(id + 0.77));
}

// The block inside a lot: its footprint after the streets round it.
vec4 tkFoot(vec2 id) {
  vec2 o = id * TK_LOT;
  vec4 m = vec4(hash21(id + 1.1), hash21(id + 2.3), hash21(id + 3.6), hash21(id + 4.8));
  m = 2.5 + 5.0 * m;
  return vec4(o + m.xz, o + TK_LOT - m.yw);
}

// Ray against a box: entry and exit distance and the entry face's normal.
vec2 tkBox(vec3 ro, vec3 inv, vec3 sg, vec3 bmin, vec3 bmax, out vec3 n) {
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float enter = max(max(tn.x, tn.y), tn.z);
  float leave = min(min(tf.x, tf.y), tf.z);
  n = enter == tn.x ? vec3(-sg.x, 0.0, 0.0) : enter == tn.y ? vec3(0.0, -sg.y, 0.0) : vec3(0.0, 0.0, -sg.z);
  return vec2(enter, leave);
}

// Glow from a point light seen along the ray: a crisp core about a cell
// across and a soft halo, both measured in cells so they read the same at
// any distance.
vec3 tkPointGlow(vec3 ro, vec3 rd, vec3 at, float limit, vec3 col) {
  vec3 d = at - ro;
  float tp = dot(d, rd);
  if (tp <= 0.0 || tp > limit) {
    return vec3(0.0);
  }
  float cells = length(d - rd * tp) / (tp * tkPix);
  return col * (exp(-cells * cells * 1.6) + 0.1 * exp(-cells * 0.9));
}

// A lot's neon sign, if it has one: where the strip stands on one of the
// block's two camera-facing walls (grid x and z), which wall (1 for the
// front, 2 for the side), and a colour pick in w; span is its bottom and
// top. Only low and mid-rise blocks on the near streets carry one.
vec4 tkSign(vec2 id, vec3 lot, vec4 foot, out vec2 span, out float pick) {
  span = vec2(0.0);
  pick = 0.0;
  if (lot.x < 12.0 || lot.x > 70.0 || lot.y > 0.0 || tkToCam((id + 0.5) * TK_LOT).y > 1700.0) {
    return vec4(0.0);
  }
  float nearBy = tkToCam((id + 0.5) * TK_LOT).y;
  if (hash21(id + 6.1) > mix(0.6, 0.25, smoothstep(500.0, 1500.0, nearBy))) {
    return vec4(0.0);
  }
  float side = hash21(id + 6.7);
  float top = lot.x - 1.5;
  span = vec2(max(5.0, top - 12.0 - 22.0 * hash21(id + 7.3)), top);
  pick = hash21(id + 8.9);
  if (side < 0.5) {
    return vec4(side < 0.25 ? foot.x + 2.0 : foot.z - 2.0, foot.y - 0.6, 1.0, 1.0);
  }
  return vec4(foot.z + 0.6, side < 0.75 ? foot.y + 2.0 : foot.w - 2.0, 2.0, 1.0);
}

vec3 tkNeon(float pick) {
  return pick < 0.32 ? vec3(1.0, 0.33, 0.24) : pick < 0.56 ? vec3(1.0, 0.62, 0.22) : pick < 0.78 ? vec3(1.0, 0.3, 0.52) : pick < 0.9 ? vec3(1.0, 0.82, 0.4) : vec3(0.4, 0.9, 1.0);
}

// Walks the city front to back. Returns the hit distance (0 for none),
// the face normal, the lot and its block, and adds the glow of the lights
// passed on the way.
float tkCity(vec3 ro, vec3 rd, out vec3 nrm, out vec2 hitId, out vec3 hitLot, inout vec3 glow) {
  vec3 sg = sign(rd);
  vec3 safe = vec3(abs(rd.x) < 1e-5 ? 1e-5 : rd.x, abs(rd.y) < 1e-5 ? 1e-5 : rd.y, rd.z);
  vec3 inv = 1.0 / safe;
  vec2 id = floor(ro.xz / TK_LOT);
  vec2 stepDir = vec2(sg.x >= 0.0 ? 1.0 : -1.0, 1.0);
  vec2 delta = abs(TK_LOT * inv.xz);
  vec2 nxt = ((id + max(stepDir, 0.0)) * TK_LOT - ro.xz) * inv.xz;
  float tGround = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  float pulse = tkTime;
  nrm = vec3(0.0);
  hitId = vec2(0.0);
  hitLot = vec3(0.0);
  float tCur = 0.0;
  for (int i = 0; i < 150; i++) {
    float tExit = min(nxt.x, nxt.y);
    vec3 lot = tkLot(id);
    float best = 1e9;
    vec3 n;
    if (lot.x > 0.0) {
      vec4 f = tkFoot(id);
      vec2 b = tkBox(ro, inv, sg, vec3(f.x, 0.0, f.y), vec3(f.z, lot.x, f.w), n);
      if (b.x < b.y && b.y > 0.0) {
        best = b.x;
        nrm = n;
      }
      float top = lot.x;
      if (lot.y > 0.0) {
        vec2 inset = (f.zw - f.xy) * 0.24;
        vec3 cn;
        vec2 cb = tkBox(ro, inv, sg, vec3(f.xy + inset, lot.x).xzy, vec3(f.zw - inset, lot.x + lot.y).xzy, cn);
        if (cb.x < cb.y && cb.y > 0.0 && cb.x < best) {
          best = cb.x;
          nrm = cn;
        }
        top += lot.y;
      }
      // Red aircraft lights on the tall roofs, pulsing slowly out of step.
      if (top > 60.0 && f.y < 4500.0) {
        float phase = hash21(id + 3.3);
        float blink = pow(0.5 + 0.5 * sin(pulse * (2.0 + phase) + phase * 6.28), 3.0);
        vec3 at = vec3((f.x + f.z) * 0.5, top + 1.5, (f.y + f.w) * 0.5);
        glow += tkPointGlow(ro, rd, at, min(best, tGround) + 30.0, vec3(1.0, 0.16, 0.1) * (0.35 + 1.1 * blink));
      }
      // Neon on the near streets spills a warm haze round the sign.
      vec2 span;
      float pick;
      vec4 sgn = tkSign(id, lot, f, span, pick);
      if (sgn.w > 0.0) {
        vec3 a = vec3(sgn.x, span.x, sgn.y);
        float tp = dot(a - ro, rd);
        vec3 q = ro + rd * tp;
        a.y = clamp(q.y, span.x, span.y);
        glow += tkPointGlow(ro, rd, a, min(best, tGround) + 4.0, tkNeon(pick) * 0.35);
      }
    }
    if (tGround < tExit && tGround < best) {
      nrm = vec3(0.0, 1.0, 0.0);
      hitId = id;
      return tGround;
    }
    if (best < 1e8) {
      hitId = id;
      hitLot = lot;
      return best;
    }
    tCur = tExit;
    if (rd.y > 0.0 && ro.y + rd.y * tCur > 330.0) {
      return 0.0;
    }
    if (nxt.x < nxt.y) {
      nxt.x += delta.x;
      id.x += stepDir.x;
    } else {
      nxt.y += delta.y;
      id.y += stepDir.y;
    }
  }
  // Past the walk, long steps carry the city on to the horizon.
  float t = tCur;
  for (int i = 0; i < 44; i++) {
    t = t * 1.06 + 12.0;
    vec3 p = ro + rd * t;
    if (p.y < 0.0) {
      nrm = vec3(0.0, 1.0, 0.0);
      hitId = floor(p.xz / TK_LOT);
      return -ro.y / rd.y;
    }
    vec2 fid = floor(p.xz / TK_LOT);
    vec3 lot = tkLot(fid);
    if (p.y < lot.x + lot.y * 0.6) {
      nrm = vec3(0.0, 0.0, -1.0);
      hitId = fid;
      hitLot = lot;
      return t;
    }
    if (rd.y > 0.0 && p.y > 330.0) {
      return 0.0;
    }
  }
  return 0.0;
}

// Windows on a wall: whole floors tend to be lit or dark together, offices
// in cool white and cyan, homes in warm light. Up close each window is its
// own shape; far off, a cell holds several and shows their share of light.
vec3 tkWindows(vec3 p, vec3 n, vec2 id, vec3 lot, float fp, float t) {
  // Along the wall, from the lot's corner, so hashes stay precise.
  float u = abs(n.x) > 0.5 ? p.z - id.y * TK_LOT : p.x - id.x * TK_LOT;
  float seed = lot.z;
  float storey = 3.4 + 0.8 * hash21(id + 0.4);
  float bay = 3.0 + 2.2 * hash21(id + 0.6);
  float busy = mix(0.12, 0.7, hash21(id + 0.9));
  float fy = p.y / storey;
  float fx = u / bay;
  // Under the roof parapet and in the shopfront floor, no office windows.
  float roof = p.y > lot.x - 0.01 ? lot.x + lot.y : lot.x;
  if (p.y > roof - 2.0 || p.y < 5.0) {
    return vec3(0.0);
  }
  float kY = max(1.0, fp / storey);
  float kX = max(1.0, fp / bay);
  vec2 cell = vec2(floor(fx / kX), floor(fy / kY));
  float floorLit = hash21(vec2(seed * 31.0, cell.y * 1.7 + floor(n.x * 3.0)));
  // Towers keep whole office floors lit; low blocks show a few homes.
  float tall = smoothstep(30.0, 70.0, lot.x);
  // Far off, every cell holds many floors, so the city reads as a carpet
  // of light.
  float far = smoothstep(storey * 2.0, storey * 6.0, fp);
  float chance = floorLit > mix(mix(0.75, 0.55, tall), 0.3, far) ? mix(0.35, 0.9, busy) : 0.05;
  float pick = hash21(cell + seed * 17.0 + n.x * 5.0);
  // A few windows switch on or off over tens of seconds.
  if (hash21(cell * 1.31 + seed) < 0.06) {
    float phase = t / (16.0 + 18.0 * hash21(cell + seed + 9.4)) + hash21(cell + 2.2) * 9.0;
    pick = mix(hash21(cell + floor(phase)), hash21(cell + floor(phase) + 1.0), smoothstep(0.8, 1.0, fract(phase)));
  }
  float lit = step(pick, chance);
  // Up close, the window's own frame; far off, the share of wall it lights.
  float shape = 1.0;
  if (fp < storey * 0.4) {
    vec2 f = fract(vec2(fx, fy));
    shape = step(0.18, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82);
  } else {
    shape = mix(0.62, 0.5, smoothstep(storey, storey * 4.0, fp));
  }
  // Homes in the low blocks burn warmer than the offices.
  float tint = hash21(vec2(seed, 3.3)) * 0.65 + hash21(cell + 6.6) * 0.35 - 0.1 * (1.0 - tall);
  vec3 col = tint < 0.22 ? vec3(1.0, 0.78, 0.5) : tint < 0.66 ? vec3(0.9, 0.97, 1.0) : vec3(0.62, 0.9, 1.0);
  float bright = hash21(cell + 1.9 + seed);
  return col * lit * shape * mix(0.45, 1.1, bright);
}

// The Skytree's half-width at m metres up: a tripod base that narrows fast
// and then slowly into a round shaft, the three-tier Tembo Deck at 340 to
// 360 m, the Tembo Galleria ring at 445 to 455 m, the top of the main
// tower at 497 m and the antenna mast to 634 m.
float tkSkytreeHalf(float m, out float part) {
  part = 0.0;
  if (m < 334.0) {
    return 15.5 + 18.5 * exp(-m / 85.0);
  }
  if (m < 366.0) {
    part = 1.0;
    return m < 339.0 ? 21.0 : m < 353.0 ? 26.0 : m < 361.0 ? 24.0 : 19.5;
  }
  if (m < 441.0) {
    return mix(15.0, 12.8, (m - 362.0) / 79.0);
  }
  if (m < 458.0) {
    part = 2.0;
    return m < 443.0 ? 15.5 : 18.5;
  }
  if (m < 497.0) {
    return mix(11.5, 8.0, (m - 456.0) / 41.0);
  }
  part = 3.0;
  if (m < 600.0) {
    return mix(4.8, 3.4, (m - 497.0) / 103.0);
  }
  return m < 622.0 ? 2.4 : 1.2;
}

// The Skytree in its Iki lighting: a pale blue lattice round a white core,
// the decks' glass bands lit, violet at the deck rims, red lights on top.
// Returns colour and cover (1 inside it); halo is the soft light round it.
vec4 tkSkytree(vec3 ro, vec3 rd, out float dist, out float halo) {
  float z = tkSkytreeAt.y;
  dist = (z - ro.z) / rd.z;
  vec3 p = ro + rd * dist;
  float across = p.x - tkSkytreeAt.x;
  float m = p.y;
  float fp = dist * tkPix;
  float part;
  float hw = tkSkytreeHalf(clamp(m, 0.0, 634.0), part);
  hw = max(hw, part > 2.5 ? 0.55 * fp : 0.9 * fp);
  float gap = max(abs(across) - hw, 0.0);
  halo = exp(-gap / 40.0) * smoothstep(0.0, 120.0, m) * (1.0 - smoothstep(480.0, 600.0, m));
  if (m < 0.0 || m > 634.0 || abs(across) > hw) {
    return vec4(0.0);
  }
  float a = clamp(across / hw, -1.0, 1.0);
  float facing = sqrt(1.0 - a * a);
  // The lattice: two families of diagonals round the shaft and rings
  // every 30 m, lit, with darker panels between them.
  float shaft = tkSkytreeHalf(clamp(m, 0.0, 337.0), part);
  float around = asin(a) * shaft;
  float panel = 26.0;
  float d1 = abs(fract((around + m * 0.62) / panel) - 0.5);
  float d2 = abs(fract((around - m * 0.62) / panel) - 0.5);
  float ring = abs(fract(m / 30.0) - 0.5);
  float width = clamp(0.5 * fp / panel, 0.06, 0.3);
  float member = max(max(smoothstep(0.5 - width, 0.5, d1), smoothstep(0.5 - width, 0.5, d2)), smoothstep(0.5 - width * 0.8, 0.5, ring));
  float core = 1.0 - smoothstep(0.25, 0.5, abs(a));
  vec3 gapCol = vec3(0.3, 0.48, 0.8);
  vec3 lattice = vec3(0.7, 0.86, 1.1);
  vec3 coreCol = vec3(1.0, 1.08, 1.15);
  vec3 col = mix(gapCol, lattice, member);
  col = mix(col, coreCol, core * mix(0.55, 0.85, member));
  // Rounder at the edges, and the west side a touch brighter in the moon.
  col *= mix(0.62, 1.0, facing) * (1.0 - 0.12 * a);
  // The upper shaft is lit warmer toward violet, as in Miyabi's evening.
  col = mix(col, col * vec3(0.97, 0.92, 1.06), smoothstep(360.0, 500.0, m));
  if (part > 0.5 && part < 2.5) {
    // The decks: a band of bright glass between violet rims.
    bool glass = part < 1.5 ? (m >= 340.0 && m < 352.0) || (m >= 354.0 && m < 360.0) : m >= 443.0;
    col = glass ? vec3(0.95, 0.97, 1.0) * mix(0.75, 1.0, facing) : vec3(0.62, 0.52, 0.95) * mix(0.6, 1.0, facing);
  }
  if (part > 2.5) {
    // The antenna mast: white, with red lights stacked up it.
    col = vec3(0.88, 0.92, 1.0) * mix(0.75, 1.0, facing);
    float beacon = 1.0 - step(5.0, abs(m - 630.0)) * step(4.0, abs(m - 560.0)) * step(4.0, abs(m - 500.0));
    float blink = pow(0.5 + 0.5 * sin(tkTime * 1.9), 3.0);
    col = mix(col, vec3(1.0, 0.18, 0.12) * (0.6 + 0.8 * blink), beacon);
  }
  return vec4(col, 1.0);
}

// Tokyo Tower, small and far: 333 m, legs flaring to 80 m, the Main Deck
// at 150 m and the Top Deck at 250 m, lit warm orange with white bands.
vec4 tkTower(vec3 ro, vec3 rd, out float dist) {
  float z = tkTowerAt.y;
  dist = (z - ro.z) / rd.z;
  vec3 p = ro + rd * dist;
  float u = abs(p.x - tkTowerAt.x);
  float m = p.y;
  float fp = dist * tkPix;
  if (m < 0.0 || m > 333.0) {
    return vec4(0.0);
  }
  float hw;
  if (m < 250.0) {
    float k = max(1.0 - m / 262.0, 0.0);
    hw = 3.4 + 37.0 * k * k;
  } else {
    hw = mix(2.6, 0.8, (m - 250.0) / 83.0);
  }
  bool deck = (m > 142.0 && m < 158.0) || (m > 244.0 && m < 254.0);
  if (deck) {
    hw = m < 200.0 ? 17.0 : 8.0;
  }
  hw = max(hw, 0.5 * fp);
  if (u > hw) {
    return vec4(0.0);
  }
  // The arch between the legs.
  if (m < 50.0 && u < hw * 0.62 && m < 50.0 * sqrt(max(1.0 - pow(u / (hw * 0.62), 2.0), 0.0)) - 4.0) {
    return vec4(0.0);
  }
  float white = step(92.0, m) * step(m, 110.0) + step(185.0, m) * step(m, 200.0) + step(272.0, m);
  vec3 col = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.86, 0.66), white);
  if (deck) {
    col = vec3(1.0, 0.92, 0.75);
  }
  if (m > 326.0) {
    col = vec3(1.0, 0.18, 0.12) * (0.6 + 0.6 * pow(0.5 + 0.5 * sin(tkTime * 1.6 + 1.0), 3.0));
  }
  return vec4(col * 0.95, 1.0);
}

// Mount Fuji, 90 km off: a concave cone with a flat top, the snow cap
// streaked down its gullies and bright on the side facing the moon. In
// tangent units, rising about three degrees above the horizon.
vec4 tkFuji(vec3 rd) {
  vec2 q = rd.xy / rd.z;
  float x = q.x - tkFujiTan;
  float peak = tkFujiPeak;
  float w = peak * 4.6;
  float prof = peak * pow(max(1.0 - abs(x) / w, 0.0), 2.25);
  prof = min(prof, peak * 0.955);
  if (q.y > prof || q.y < -0.01) {
    return vec4(0.0);
  }
  // The moon is in the west, to the left: that flank is lit.
  float lit = 1.0 - smoothstep(-0.004, 0.01, x);
  vec3 body = mix(vec3(0.17, 0.22, 0.32), vec3(0.3, 0.36, 0.48), lit);
  float gully = 1.0 - abs(snoise(vec2(x * 380.0, 3.0)));
  float snowLine = peak * (0.42 + 0.14 * gully * gully) + 0.0015 * snoise(vec2(x * 900.0, 1.0));
  float snow = smoothstep(snowLine - 0.0008, snowLine + 0.0008, q.y);
  vec3 snowCol = mix(vec3(0.5, 0.62, 0.74), vec3(0.88, 0.94, 1.0), lit);
  vec3 col = mix(body, snowCol, snow);
  // Its foot sinks into the glow over the city.
  col = mix(col, tkHaze(rd), (1.0 - smoothstep(0.0, peak * 0.4, q.y)) * 0.75);
  return vec4(col, 1.0);
}

// Snap a colour to the nearest of the scene's palette.
void tkTry(vec3 q, vec3 c, inout vec3 best, inout float bd) {
  q /= 255.0;
  vec3 d = q - c;
  float e = dot(d * d, vec3(0.32, 0.46, 0.22));
  if (e < bd) {
    bd = e;
    best = q;
  }
}

vec3 tkPalette(vec3 c) {
  vec3 best = vec3(0.0);
  float bd = 1e9;
  // Night air and haze, from near black to the glow at the horizon.
  tkTry(vec3(6.0, 14.0, 19.0), c, best, bd);
  tkTry(vec3(10.0, 24.0, 31.0), c, best, bd);
  tkTry(vec3(15.0, 36.0, 45.0), c, best, bd);
  tkTry(vec3(22.0, 50.0, 60.0), c, best, bd);
  tkTry(vec3(31.0, 66.0, 76.0), c, best, bd);
  tkTry(vec3(42.0, 84.0, 94.0), c, best, bd);
  tkTry(vec3(56.0, 104.0, 112.0), c, best, bd);
  tkTry(vec3(74.0, 126.0, 132.0), c, best, bd);
  tkTry(vec3(98.0, 150.0, 154.0), c, best, bd);
  tkTry(vec3(128.0, 174.0, 176.0), c, best, bd);
  tkTry(vec3(164.0, 198.0, 198.0), c, best, bd);
  tkTry(vec3(204.0, 224.0, 222.0), c, best, bd);
  // Walls and roofs in shadow and in the moon.
  tkTry(vec3(14.0, 20.0, 30.0), c, best, bd);
  tkTry(vec3(24.0, 32.0, 46.0), c, best, bd);
  tkTry(vec3(36.0, 46.0, 62.0), c, best, bd);
  tkTry(vec3(52.0, 64.0, 82.0), c, best, bd);
  tkTry(vec3(76.0, 90.0, 108.0), c, best, bd);
  tkTry(vec3(110.0, 126.0, 144.0), c, best, bd);
  // Window light: office white, fluorescent cyan, warm rooms.
  tkTry(vec3(240.0, 248.0, 250.0), c, best, bd);
  tkTry(vec3(200.0, 232.0, 242.0), c, best, bd);
  tkTry(vec3(140.0, 214.0, 232.0), c, best, bd);
  tkTry(vec3(255.0, 224.0, 170.0), c, best, bd);
  tkTry(vec3(250.0, 190.0, 112.0), c, best, bd);
  tkTry(vec3(200.0, 140.0, 84.0), c, best, bd);
  tkTry(vec3(130.0, 96.0, 70.0), c, best, bd);
  // Neon and aircraft lights.
  tkTry(vec3(255.0, 92.0, 70.0), c, best, bd);
  tkTry(vec3(255.0, 150.0, 64.0), c, best, bd);
  tkTry(vec3(255.0, 86.0, 140.0), c, best, bd);
  tkTry(vec3(255.0, 210.0, 100.0), c, best, bd);
  tkTry(vec3(226.0, 44.0, 36.0), c, best, bd);
  tkTry(vec3(150.0, 34.0, 34.0), c, best, bd);
  tkTry(vec3(150.0, 64.0, 90.0), c, best, bd);
  tkTry(vec3(110.0, 226.0, 255.0), c, best, bd);
  // The Skytree: pale blue lattice, white core, violet rims.
  tkTry(vec3(232.0, 242.0, 255.0), c, best, bd);
  tkTry(vec3(180.0, 210.0, 248.0), c, best, bd);
  tkTry(vec3(132.0, 170.0, 232.0), c, best, bd);
  tkTry(vec3(84.0, 120.0, 196.0), c, best, bd);
  tkTry(vec3(50.0, 80.0, 150.0), c, best, bd);
  tkTry(vec3(150.0, 130.0, 236.0), c, best, bd);
  tkTry(vec3(100.0, 86.0, 170.0), c, best, bd);
  // Tokyo Tower's orange.
  tkTry(vec3(255.0, 112.0, 40.0), c, best, bd);
  tkTry(vec3(255.0, 220.0, 170.0), c, best, bd);
  // Fuji's snow and the moon.
  tkTry(vec3(188.0, 208.0, 228.0), c, best, bd);
  tkTry(vec3(226.0, 236.0, 248.0), c, best, bd);
  tkTry(vec3(96.0, 120.0, 146.0), c, best, bd);
  tkTry(vec3(246.0, 248.0, 238.0), c, best, bd);
  return best;
}

vec4 tkScene(vec2 uv, vec2 res, float t) {
  if (uv == tkCacheUv && t == tkCacheT) {
    return tkCacheValue;
  }
  float aspect = res.x / res.y;
  vec2 cells = floor(ascii_samples / tkGrid + 0.5);
  tkCellIndex = floor(uv * cells);
  tkTime = t;
  // A wide box shows about 56 degrees across; a tall one keeps about 25
  // across and gains height instead, so the tower fills a phone.
  float tanY = max(0.32, 0.25 / aspect);
  float tanX = tanY * aspect;
  float portrait = 1.0 - smoothstep(0.6, 1.3, aspect);
  tkPix = 2.0 * tanY / cells.y;
  // Where the landmarks land across the frame, as a fraction of its width.
  float skytreeX = mix(0.775, 0.7, portrait);
  float skytreeZ = mix(1750.0, 1080.0, portrait);
  tkSkytreeAt = vec2((skytreeX - 0.5) * 2.0 * tanX * skytreeZ, skytreeZ);
  float towerZ = 3800.0;
  tkTowerAt = vec2((mix(0.085, 0.12, portrait) - 0.5) * 2.0 * tanX * towerZ, towerZ);
  tkFujiTan = (mix(0.25, 0.3, portrait) - 0.5) * 2.0 * tanX;
  // A phone's view is narrower, so Fuji is drawn a little larger to read.
  tkFujiPeak = 0.072 * mix(1.0, 1.45, portrait);
  vec3 moonDir = vec3((mix(0.17, 0.2, portrait) - 0.5) * 2.0 * tanX, (mix(0.82, 0.86, portrait) - TK_HORIZON) * 2.0 * tanY, 1.0);
  tkMoon = normalize(moonDir);

  // A shifted lens, as for architecture: verticals stay vertical and the
  // horizon sits a third of the way up.
  vec3 rd = normalize(vec3((uv.x - 0.5) * 2.0 * tanX, (uv.y - TK_HORIZON) * 2.0 * tanY, 1.0));
  vec3 ro = vec3(0.0, TK_CAM, 0.0);

  vec3 glow = vec3(0.0);
  vec3 nrm;
  vec2 id;
  vec3 lot;
  vec2 rdGrid = tkToGrid(rd.xz);
  vec3 rg = vec3(rdGrid.x, rd.y, rdGrid.y);
  float tCity = tkCity(ro, rg, nrm, id, lot, glow);
  float hit = tCity > 0.0 ? tCity : 1e9;

  vec3 col;
  float floorTone = 0.16;
  float sDist;
  float sHalo;
  vec4 skytree = tkSkytree(ro, rd, sDist, sHalo);
  float tDist;
  vec4 tower = tkTokyoTowerOn > 0.5 ? tkTower(ro, rd, tDist) : vec4(0.0);

  if (skytree.a > 0.5 && sDist < hit) {
    col = skytree.rgb * 1.35;
    floorTone = 0.4;
  } else if (tower.a > 0.5 && tDist < hit) {
    col = mix(tower.rgb, tkHaze(rd), 0.18);
    floorTone = 0.25;
  } else if (tCity > 0.0) {
    // p and nrm are in the street grid's frame; nCam is the normal as
    // the camera and the moon see it.
    vec3 p = ro + rg * tCity;
    vec2 nc = tkToCam(nrm.xz);
    vec3 nCam = vec3(nc.x, nrm.y, nc.y);
    float fp = tCity * tkPix;
    vec3 amb = vec3(0.2, 0.27, 0.31);
    vec3 moon = vec3(0.4, 0.5, 0.56);
    vec3 street = vec3(0.55, 0.38, 0.22);
    if (nrm.y > 0.5 && p.y < 0.5) {
      // A street: dark asphalt in the warm light of shops and lamps. The
      // avenues carry rows of lamps and streams of car lights, so they
      // run off toward the horizon as lines of light.
      float busy = tkNoise(p.xz * 0.08);
      col = vec3(0.05, 0.06, 0.07) + street * (0.1 + 0.25 * busy) * smoothstep(3500.0, 900.0, tCity);
      vec2 local = p.xz - id * TK_LOT;
      bool alongZ = mod(id.x, 7.0) < 0.5;
      bool alongX = mod(id.y, 6.0) < 0.5;
      if (alongZ || alongX) {
        float across = alongZ ? local.x : local.y;
        float run = alongZ ? p.z : p.x;
        float edge = min(across, TK_LOT - across);
        // Lamps along both kerbs, sodium-warm, and four lanes of traffic:
        // white headlights coming, red tail lights going.
        float lamps = step(edge, 5.0) * step(fract(run / 24.0), 0.18);
        float lane = floor(across / (TK_LOT / 4.0));
        // Traffic creeps along at a walking pace, one way per side.
        float flow = run + t * (lane < 1.5 ? -5.0 : 5.0);
        float cars = step(0.62, hash21(vec2(floor(flow / 9.0), lane + id.x * 3.0))) * step(fract(flow / 9.0), 0.5);
        vec3 carCol = lane < 1.5 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.2, 0.14);
        vec3 near = vec3(1.0, 0.8, 0.55) * lamps * 0.9 + carCol * cars * 0.6 * step(4.0, edge);
        // Far off, a cell spans many lamps and cars: their share of light.
        vec3 share = vec3(1.0, 0.76, 0.5) * 0.22 + vec3(0.9, 0.5, 0.4) * 0.08;
        col += mix(near, share, smoothstep(6.0, 24.0, fp)) * smoothstep(9000.0, 2000.0, tCity);
        floorTone = 0.24;
      }
    } else if (nrm.y > 0.5) {
      // A roof, catching the low moon.
      float shade = 0.75 + 0.5 * hash21(id + 0.3);
      col = vec3(0.5, 0.55, 0.6) * shade * (amb + moon * max(dot(nCam, tkMoon), 0.0) * 1.2);
    } else {
      // A wall: concrete or dark glass, lit by the sky, the moon and the
      // streets below, with its windows and shopfront.
      float glass = step(0.62, hash21(id + 0.2)) * step(60.0, lot.x);
      vec3 albedo = mix(vec3(0.5, 0.55, 0.6), vec3(0.28, 0.36, 0.46), glass) * (0.75 + 0.4 * hash21(id + 0.3));
      float moonOn = max(dot(nCam, tkMoon), 0.0);
      vec3 light = amb + moon * moonOn * 0.9 + street * 0.55 * exp(-p.y / 22.0) * smoothstep(3000.0, 600.0, tCity);
      col = albedo * light;
      // The edge of each wall catches a little more light, so blocks
      // stand apart where they overlap.
      vec2 lp = p.xz - tkFoot(id).xy;
      vec2 size = tkFoot(id).zw - tkFoot(id).xy;
      float rim = abs(nrm.x) > 0.5 ? min(lp.y, size.y - lp.y) : min(lp.x, size.x - lp.x);
      col *= 1.0 + 0.6 * (1.0 - smoothstep(0.0, max(fp * 1.2, 1.5), rim));
      col += tkWindows(p, nrm, id, lot, fp, t) * 1.3;
      // Shopfronts glowing along the foot of the near blocks.
      if (p.y < 4.5 && fp < 10.0) {
        float shop = hash21(floor(vec2(abs(nrm.x) > 0.5 ? p.z : p.x, 0.0) / 6.0) + id);
        col += vec3(1.0, 0.72, 0.42) * step(0.35, shop) * 0.7;
      }
      // A vertical neon sign on the camera-facing wall: a lit strip with
      // the gaps between its characters.
      vec4 f = tkFoot(id);
      vec2 span;
      float pick;
      vec4 sgn = tkSign(id, lot, f, span, pick);
      float signHalf = max(1.8, 0.75 * fp);
      bool onWall = sgn.z < 1.5 ? nrm.z < -0.5 && abs(p.x - sgn.x) < signHalf : nrm.x > 0.5 && abs(p.z - sgn.y) < signHalf;
      if (sgn.w > 0.0 && onWall && p.y > span.x && p.y < span.y) {
        float letter = step(0.18, fract((p.y - span.x) / 2.6));
        float breathe = 0.92 + 0.08 * sin(t * 0.7 + pick * 20.0);
        col = tkNeon(pick) * mix(0.8, 1.6, letter) * breathe;
        floorTone = 0.3;
      }
    }
    // Haze thickens with distance and settles low over the far city.
    float fog = 1.0 - exp(-tCity / 2300.0);
    fog = max(fog, (1.0 - exp(-tCity / 1800.0)) * exp(-p.y / 90.0) * 0.85);
    float drift = tkNoise(vec2(p.x * 0.002 + t * 0.02, p.z * 0.001 + 7.0));
    fog *= mix(0.85, 1.1, drift);
    col = mix(col, tkHaze(rd), clamp(fog, 0.0, 0.94));
    floorTone = mix(0.2, 0.2, fog);
  } else {
    // Open sky: the horizon glow, the moon, a few stars and thin cloud.
    col = tkSky(rd);
    if (tkFujiOn > 0.5) {
      vec4 fuji = tkFuji(rd);
      if (fuji.a > 0.5) {
        col = fuji.rgb;
      }
    }
    if (rd.y > 0.02) {
      vec2 cp = rd.xz / rd.y;
      float drift = t * 0.012;
      float cloud = fbm(vec2(cp.x * 0.45 + drift, cp.y * 0.6));
      cloud = smoothstep(0.45, 0.8, cloud) * smoothstep(0.07, 0.2, rd.y) * (1.0 - smoothstep(0.4, 0.65, rd.y));
      // Lit from below by the city, and silver where they pass the moon.
      vec3 cloudCol = mix(vec3(0.2, 0.33, 0.37), vec3(0.5, 0.6, 0.62), exp((dot(rd, tkMoon) - 1.0) * 10.0));
      col = mix(col, cloudCol, cloud * 0.4);
      float starZone = smoothstep(0.16, 0.3, rd.y);
      if (hash21(tkCellIndex + 0.71) < 0.01 * starZone) {
        float tw = 0.55 + 0.45 * sin(t * 0.8 + hash21(tkCellIndex) * 40.0);
        col = mix(col, vec3(0.82, 0.92, 0.96), 0.6 * tw);
      }
    }
    float moonD = acos(clamp(dot(rd, tkMoon), -1.0, 1.0));
    float disc = 1.0 - smoothstep(0.011, 0.0135, moonD);
    col = mix(col, vec3(0.95, 0.97, 0.92), disc);
    floorTone = 0.17 + 0.2 * disc;
  }

  // Street light caught in the low haze: rays that run long and low between
  // the blocks gather it, so buildings stand dark against a warm glow.
  if (rd.y < 0.0) {
    float tEnd = tCity > 0.0 ? tCity : 9000.0;
    float h0 = 34.0;
    float k = -rd.y / h0;
    float gather = (exp(-(TK_CAM + rd.y * tEnd) / h0) - exp(-TK_CAM / h0)) / k;
    gather = min(gather, 2400.0) / 2400.0;
    col += vec3(0.62, 0.44, 0.3) * gather * 0.9;
  }
  // The soft light round the Skytree, and the lights met on the way.
  if (skytree.a < 0.5 && sDist < hit + 200.0) {
    col += vec3(0.14, 0.24, 0.42) * sHalo * 0.45;
  }
  // Tokyo Tower's floodlights warm the haze round it.
  if (tkTokyoTowerOn > 0.5) {
    vec2 tq = rd.xy / rd.z * tkTowerAt.y - vec2(tkTowerAt.x, -TK_CAM);
    float tg = exp(-length(vec2(tq.x, (tq.y - 170.0) * 0.45)) / 70.0);
    col += vec3(0.5, 0.2, 0.06) * tg * 0.5;
  }
  col += glow;

  // Quiet the middle band, where a headline sits, when intensity drops.
  float quiet = 1.0 - tkIntensity;
  float centreY = 1.0 - smoothstep(0.15, 0.26, abs(uv.y - 0.525));
  float centreX = 1.0 - smoothstep(0.24, 0.36, abs(uv.x - 0.5));
  float dim = 1.0 - quiet * (0.35 + 0.5 * centreY * centreX);

  // Dot size follows brightness above a floor, so even the darkest walls
  // keep a fine screen of dots.
  col = max(col, vec3(0.0));
  col = 1.0 - exp(-col * 1.25);
  float peak = max(max(col.r, col.g), col.b);
  float tone = floorTone + (1.0 - floorTone) * pow(peak, 1.15);
  tone = clamp(tone * mix(0.5, 1.0, dim), 0.0, 1.0);
  // Each dot shows its hue: brighter for big dots, kept dim in shadow.
  float s = (0.32 + 0.68 * smoothstep(0.1, 0.8, tone)) * mix(0.5, 1.0, smoothstep(0.05, 0.5, peak)) / max(peak, 0.001);
  vec3 ink = tkPalette(clamp(col * s * mix(0.6, 1.0, dim), 0.0, 1.0));

  tkCacheUv = uv;
  tkCacheT = t;
  tkCacheValue = vec4(ink, tone);
  return tkCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return tkScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return tkScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#050b0e";
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
        "linear-gradient(to top, #070d12 0%, #101a22 22%, #3b5a62 33%, #5f8a8e 35%, #1d3d46 46%, #0c1d25 72%, #071015 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface TokyoProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Lower values quiet the middle band most. Default 1. */
  intensity?: number;
  /** Mount Fuji, small and moonlit on the far horizon. Default `true`. */
  fuji?: boolean;
  /** Tokyo Tower, a small orange accent far off to the left. Default `true`. */
  tokyoTower?: boolean;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for one-glyph charsets such as `dots`; `false`
   * for Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** Ordered dithering between dot sizes, which turns five dots into smooth tone. Default `"bayer4"`. */
  dither?: AsciiSceneProps["dither"];
  /** Ignored: the city doesn't respond to the pointer. Accepted so any stage can pass it. */
  interactive?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night colour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a night gradient. */
  fallback?: ReactNode;
}

/**
 * Tokyo at night from a rooftop in the east of the city, built in 3D and
 * drawn as a halftone of coloured dots. The Tokyo Skytree rises at the
 * right in pale blue light over a dense city that runs to the horizon:
 * lit windows, red aircraft lights on the tall roofs and warm neon on the
 * near streets, with Tokyo Tower small and orange in the distance and
 * Mount Fuji moonlit on the far horizon. Motion is calm: a few windows
 * change, aircraft lights pulse, haze drifts and stars twinkle.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Tokyo = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  dither = "bayer4",
  square,
  cell = 7,
  stillTime = 4,
  interactive: _interactive,
  intensity = 1,
  fuji = true,
  tokyoTower = true,
  fallback = FALLBACK,
  ...props
}: TokyoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const { kind, grid } = resolveCharset(charset, chars);
  const stretches = kind === "braille" || kind === "quadrants";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        tkFujiOn: fuji ? 1 : 0,
        // Samples per glyph, so stars and sizes count whole cells.
        tkGrid: [grid[0], grid[1]],
        tkIntensity: clamp(intensity, 0, 1),
        tkTokyoTowerOn: tokyoTower ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={dither}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      square={square ?? !stretches}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};

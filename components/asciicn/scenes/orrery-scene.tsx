"use client";

import { useEffect, useRef } from "react";
import type { ReactNode, Ref } from "react";

import { useFrameLoop } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Every gear has the same module (tooth size), so any two can mesh: their
// centres sit one pitch radius apart each, and the follower turns at
// -teeth(a) / teeth(b) of its driver. Each gear is placed by the angle it
// leaves its driver at, and its phase is set so a tooth of one always sits
// in a gap of the other on the line between their centres.
const MODULE = 0.06;

type Metal = "brass" | "bronze";

interface GearSpec {
  /** Number of teeth. */
  teeth: number;
  /** Index of the gear it meshes with: 0 is the centre wheel. */
  mesh: number;
  /** Direction from that gear's centre, in degrees on the plate. */
  at: number;
  /** Height of its top face above the plate. */
  top: number;
  /** Spokes cut through the web; 0 keeps it solid. */
  spokes: number;
  metal: Metal;
}

/** The centre wheel under the sun, which drives the whole train. */
const DRIVER = {
  metal: "bronze",
  spokes: 4,
  teeth: 12,
  top: 0.07,
} as const satisfies Omit<GearSpec, "mesh" | "at">;

const TRAIN = [
  { at: 15, mesh: 0, metal: "brass", spokes: 0, teeth: 8, top: 0.05 },
  { at: 108, mesh: 0, metal: "brass", spokes: 0, teeth: 10, top: 0.045 },
  { at: 200, mesh: 0, metal: "brass", spokes: 0, teeth: 9, top: 0.05 },
  { at: 285, mesh: 0, metal: "brass", spokes: 0, teeth: 6, top: 0.055 },
] as const satisfies readonly GearSpec[];

interface PlacedGear {
  x: number;
  z: number;
  radius: number;
  teeth: number;
  /** Turns per turn of the centre wheel; negative runs the other way. */
  ratio: number;
  /** Angle of a tooth centre when the centre wheel is at 0. */
  phase: number;
  top: number;
  spokes: number;
  metal: Metal;
}

const placeTrain = (): PlacedGear[] => {
  const placed: PlacedGear[] = [
    {
      ...DRIVER,
      phase: 0,
      radius: (MODULE * DRIVER.teeth) / 2,
      ratio: 1,
      x: 0,
      z: 0,
    },
  ];
  for (const gear of TRAIN) {
    const driver = placed[gear.mesh];
    if (!driver) {
      continue;
    }
    const radius = (MODULE * gear.teeth) / 2;
    const toward = (gear.at * Math.PI) / 180;
    const reach = driver.radius + radius;
    placed.push({
      metal: gear.metal,
      // Tooth phase plus gap phase along the contact line stays a half
      // pitch as both turn, so the teeth interleave.
      phase:
        toward +
        Math.PI -
        Math.PI / gear.teeth +
        ((toward - driver.phase) * driver.teeth) / gear.teeth,
      radius,
      ratio: (-driver.ratio * driver.teeth) / gear.teeth,
      spokes: gear.spokes,
      teeth: gear.teeth,
      top: gear.top,
      x: driver.x + Math.cos(toward) * reach,
      z: driver.z + Math.sin(toward) * reach,
    });
  }
  return placed;
};

const glslFloat = (value: number) => {
  const text = value.toFixed(5);
  return text.includes(".") ? text : `${text}.0`;
};

const GEAR_CALLS = placeTrain()
  .map(
    (gear) =>
      `  orGear(p, best, vec2(${glslFloat(gear.x)}, ${glslFloat(gear.z)}), ${glslFloat(gear.teeth)}, ${glslFloat(gear.radius)}, orTheta * ${glslFloat(gear.ratio)} + ${glslFloat(gear.phase)}, ${glslFloat(gear.top)}, ${glslFloat(gear.spokes)}, ${gear.metal === "brass" ? "3.0" : "4.0"});`
  )
  .join("\n");

// A ray march of the whole instrument: a bronze plate with a brass bezel,
// the gear train lying on it, a column up to the sun and three arms out to
// the planets. Gears are 2D outlines extruded into slabs. Flat faces shine
// like spun metal, a bright streak across each wheel that stays put while
// the teeth turn through it. Materials: 1 plate, 2 bezel, 3 brass, 4
// bronze, 5 steel, 6 sun, 7 arms, 8-12 planets, ring and moon.
const SCENE = `
const float OR_M = ${glslFloat(MODULE)};
const float OR_PLATE = 1.3;
const vec3 OR_SUN = vec3(0.0, 0.5, 0.0);
const float OR_SUN_R = 0.16;

// Set once per sample before marching.
float orTheta = 0.0;
float orSkipSun = 0.0;
vec3 orPlanetA = vec3(0.0);
vec3 orPlanetB = vec3(0.0);
vec3 orPlanetC = vec3(0.0);
vec3 orMoon = vec3(0.0);
// What the map last hit on a gear: outline distance and the gear's centre.
float orEdge = 0.0;
vec2 orCenter = vec2(0.0);
float orRadius = 0.0;

float orExtrude(float d, float y, float lo, float hi) {
  vec2 w = vec2(d, abs(y - 0.5 * (lo + hi)) - 0.5 * (hi - lo));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

float orSegment(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// A spur gear in its own frame: tapered teeth on a root circle, a bore,
// and spoked windows through the web.
float orGear2D(vec2 q, float teeth, float radius, float spokes) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float sector = 6.2831853 / teeth;
  float local = mod(a + 0.5 * sector, sector) - 0.5 * sector;
  float halfWidth = 0.72 * OR_M - (r - radius) * 0.32;
  float tooth = max(abs(local) * r - halfWidth, r - radius - OR_M) * 0.85;
  float d = min(r - radius + 1.25 * OR_M, tooth);
  d = max(d, 0.02 - r);
  if (spokes > 0.5) {
    float rim = radius - 2.3 * OR_M;
    float hub = 0.05 + radius * 0.12;
    float span = 6.2831853 / spokes;
    float arc = abs(mod(a + 0.5 * span, span) - 0.5 * span) * r;
    float window = max(max(r - rim, hub - r), 0.016 + radius * 0.05 - arc);
    d = max(d, -(window + 0.008));
  }
  return d;
}

void orGear(vec3 p, inout vec2 best, vec2 c, float teeth, float radius, float angle, float top, float spokes, float mat) {
  vec2 q = p.xz - c;
  float bound = max(length(q) - radius - OR_M, abs(p.y - 0.5 * top) - 0.5 * top - 0.03);
  if (bound > best.x) {
    return;
  }
  if (bound > 0.05) {
    best = vec2(bound, mat);
    return;
  }
  float ca = cos(angle);
  float sa = sin(angle);
  vec2 l = vec2(ca * q.x + sa * q.y, ca * q.y - sa * q.x);
  float d2 = orGear2D(l, teeth, radius, spokes);
  float d = orExtrude(d2, p.y, 0.0, top);
  if (d < best.x) {
    best = vec2(d, mat);
    orEdge = d2;
    orCenter = c;
    orRadius = radius;
  }
  // A steel dome caps each arbor.
  float cap = orExtrude(length(q) - 0.024, p.y, top - 0.01, top + 0.014) - 0.007;
  if (cap < best.x) {
    best = vec2(cap, 5.0);
  }
}

// A collar on the column, an arm out to the orbit, a post up to the planet.
void orArm(vec3 p, inout vec2 best, vec3 planet, float height, float size, float mat) {
  vec3 foot = vec3(planet.x, height, planet.z);
  float metal = orSegment(p, vec3(0.0, height, 0.0), foot, 0.02);
  metal = min(metal, orExtrude(length(p.xz) - 0.065, p.y, height - 0.016, height + 0.016));
  metal = min(metal, orSegment(p, foot, planet, 0.016));
  if (metal < best.x) {
    best = vec2(metal, 7.0);
  }
  float ball = length(p - planet) - size;
  if (ball < best.x) {
    best = vec2(ball, mat);
  }
}

vec3 orRingFrame(vec3 q) {
  float c = 0.906;
  float s = 0.423;
  return vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
}

vec2 orMap(vec3 p) {
  float r = length(p.xz);
  vec2 best = vec2(orExtrude(r - OR_PLATE, p.y, -0.1, 0.0), 1.0);
  float bezel = orExtrude(abs(r - 1.255) - 0.045, p.y, -0.1, 0.035);
  if (bezel < best.x) {
    best = vec2(bezel, 2.0);
  }
${GEAR_CALLS}
  float column = orExtrude(r - 0.038, p.y, 0.0, OR_SUN.y);
  if (column < best.x) {
    best = vec2(column, 5.0);
  }
  orArm(p, best, orPlanetA, 0.13, 0.065, 8.0);
  orArm(p, best, orPlanetB, 0.19, 0.085, 9.0);
  orArm(p, best, orPlanetC, 0.25, 0.075, 11.0);
  vec3 rq = orRingFrame(p - orPlanetB);
  float ring = orExtrude(abs(length(rq.xz) - 0.14) - 0.034, rq.y, -0.004, 0.004);
  if (ring < best.x) {
    best = vec2(ring, 10.0);
  }
  float moonArm = orSegment(p, orPlanetC, orMoon, 0.006);
  if (moonArm < best.x) {
    best = vec2(moonArm, 7.0);
  }
  float moon = length(p - orMoon) - 0.032;
  if (moon < best.x) {
    best = vec2(moon, 12.0);
  }
  if (orSkipSun < 0.5) {
    float sun = length(p - OR_SUN) - OR_SUN_R;
    if (sun < best.x) {
      best = vec2(sun, 6.0);
    }
  }
  return best;
}

vec3 orNormal(vec3 p) {
  vec2 k = vec2(1.0, -1.0) * 0.0015;
  return normalize(
    k.xyy * orMap(p + k.xyy).x +
    k.yyx * orMap(p + k.yyx).x +
    k.yxy * orMap(p + k.yxy).x +
    k.xxx * orMap(p + k.xxx).x
  );
}

// The sun glows rather than blocks, so it casts no shadow.
float orShadow(vec3 ro, vec3 rd) {
  orSkipSun = 1.0;
  float lit = 1.0;
  float t = 0.012;
  for (int i = 0; i < 28; i++) {
    float h = orMap(ro + rd * t).x;
    lit = min(lit, 9.0 * h / t);
    t += clamp(h, 0.01, 0.12);
    if (lit < 0.02 || t > 2.2) {
      break;
    }
  }
  orSkipSun = 0.0;
  return clamp(lit, 0.0, 1.0);
}

// Tooth gaps, spoke windows and the plate under the arms fall dark.
float orOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i = 1; i < 5; i++) {
    float h = 0.012 + 0.028 * float(i);
    occ += (h - orMap(p + n * h).x) * weight;
    weight *= 0.62;
  }
  return clamp(1.0 - occ * 3.2, 0.0, 1.0);
}

// A groove one sample wide or wider, 1 at its centre.
float orGroove(float d, float width) {
  return 1.0 - smoothstep(width * 0.25, width * 0.75, abs(d));
}

vec3 orSurface(vec3 pos, vec3 rd, float mat, float pix) {
  vec3 n = orNormal(pos);
  vec3 view = -rd;
  if (mat > 5.5 && mat < 6.5) {
    vec3 s = normalize(pos - OR_SUN);
    float spin = orTheta * 0.6;
    vec2 g = vec2(s.x * cos(spin) + s.z * sin(spin), s.y);
    float grain = snoise(g * 5.0 + 3.1) * 0.5 + snoise(g * 11.0) * 0.25;
    float limb = max(dot(n, view), 0.0);
    vec3 col = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.86, 0.5), pow(limb, 0.7));
    return col * (1.45 + grain * 0.35);
  }
  vec3 light = normalize(vec3(-0.42, 1.0, 0.3));
  vec3 halfway = normalize(light + view);
  float shadow = orShadow(pos + n * 0.004, light);
  float occ = orOcclusion(pos, n);
  float diff = max(dot(n, light), 0.0) * mix(0.4, 1.0, shadow);
  vec3 toSun = OR_SUN - pos;
  float sunDist = length(toSun);
  float sunDiff = max(dot(n, toSun / sunDist), 0.0) / (1.0 + sunDist * sunDist * 3.0);
  vec3 sunCol = vec3(1.0, 0.62, 0.28);
  float r = length(pos.xz);
  bool face = n.y > 0.92;

  vec3 albedo = vec3(0.86, 0.63, 0.3);
  float shine = 1.0;
  if (mat < 1.5) {
    albedo = vec3(0.15, 0.1, 0.06);
    shine = 0.0;
  } else if (mat < 2.5) {
    albedo = vec3(0.56, 0.38, 0.2);
  } else if (mat < 3.5) {
    albedo = vec3(0.88, 0.65, 0.31);
  } else if (mat < 4.5) {
    albedo = vec3(0.74, 0.44, 0.22);
  } else if (mat < 5.5) {
    albedo = vec3(0.64, 0.66, 0.7);
    shine = 1.4;
  } else if (mat < 7.5) {
    albedo = vec3(0.85, 0.64, 0.33);
  } else if (mat < 8.5) {
    albedo = vec3(0.86, 0.36, 0.2);
    shine = 0.3;
  } else if (mat < 9.5) {
    float bands = sin(((pos.y - orPlanetB.y) / 0.085) * 9.0) * 0.5 + 0.5;
    albedo = mix(vec3(0.9, 0.74, 0.46), vec3(0.72, 0.5, 0.3), bands * 0.6);
    shine = 0.3;
  } else if (mat < 10.5) {
    float lane = length(orRingFrame(pos - orPlanetB).xz);
    albedo = vec3(0.92, 0.8, 0.58) * (0.75 + 0.25 * step(0.135, lane));
    shine = 0.4;
  } else if (mat < 11.5) {
    vec3 s = normalize(pos - orPlanetC);
    float land = smoothstep(0.05, 0.25, snoise(s.xy * 3.0 + s.z * 2.0 + orTheta * 0.4));
    albedo = mix(vec3(0.16, 0.38, 0.8), vec3(0.3, 0.62, 0.42), land);
    shine = 0.5;
  } else {
    albedo = vec3(0.7, 0.7, 0.72);
    shine = 0.2;
  }

  // Engraving: orbit lines on the plate, the chapter ring on the bezel.
  // Fine work fades once a sample is too coarse to draw it cleanly.
  float cut = 0.0;
  float width = max(0.007, pix * 1.1);
  float fine = 1.0 - smoothstep(0.012, 0.025, pix);
  if (face && mat < 1.5) {
    cut = max(orGroove(r - 0.6, width), max(orGroove(r - 0.92, width), orGroove(r - 1.16, width)));
  } else if (face && mat < 2.5) {
    float a = atan(pos.z, pos.x) / 6.2831853 * 72.0;
    float tick = abs(fract(a + 0.5) - 0.5) * (6.2831853 / 72.0) * r;
    bool major = abs(mod(floor(a + 0.5), 6.0)) < 0.5;
    float inner = major ? 1.22 : 1.25;
    cut = orGroove(tick, width) * step(inner, r) * step(r, 1.29) * (major ? 1.0 : fine);
  }
  if (face && mat > 2.5 && mat < 4.5) {
    // The web between hub and rim is turned down a step, so each wheel
    // reads as a rim of teeth round a darker disc.
    float g = length(pos.xz - orCenter);
    float rimIn = orRadius - 2.2 * OR_M;
    float hub = 0.05 + orRadius * 0.12;
    float web = step(g, rimIn) * step(hub, g);
    albedo *= 1.0 - web * 0.25 * fine;
    cut = max(orGroove(g - rimIn, width), orGroove(g - hub, width)) * fine;
  }
  // Lines on the dark plate are inlaid brass; on brass they are cut dark.
  albedo = mat < 1.5
    ? mix(albedo, vec3(0.72, 0.52, 0.26), cut * orEngrave)
    : albedo * (1.0 - cut * 0.8 * orEngrave);

  // Lit in a few clear bands so glyph ramps can tell them apart: faces in
  // the middle, walls and shadow below, rims above, glints at the top.
  float key = 0.35 + 0.65 * max(dot(n, light), 0.0);
  // Raised faces stay even; only the plate and walls gather occlusion.
  float lit = key * mix(0.55, 1.0, shadow) * mix(0.6, 1.0, face && mat > 1.5 ? 1.0 : occ);
  vec3 col;
  if (mat > 7.5 && mat != 10.0) {
    // Planets and the moon take their day side from the sun.
    float day = max(dot(n, toSun / sunDist), 0.0);
    col = albedo * (0.06 + 0.85 * day + 0.12 * key * shadow);
  } else {
    col = albedo * (lit * 0.46 + sunDiff * 0.35) * vec3(1.0, 0.96, 0.9);
  }
  col += albedo * vec3(0.03, 0.035, 0.06);
  float spec;
  if (face && mat < 5.5) {
    // Spun metal: brushed in circles round each arbor, so the highlight
    // is a streak toward the light that stays put as the teeth turn.
    vec2 q = pos.xz - orCenter;
    vec3 tangent = normalize(vec3(-q.y, 0.0, q.x) + 1e-5);
    float th = dot(tangent, halfway);
    spec = pow(sqrt(max(1.0 - th * th, 0.0)), 40.0) * 0.32;
  } else {
    spec = pow(max(dot(n, halfway), 0.0), 60.0) * 1.2;
  }
  col += mix(vec3(1.0), albedo, 0.45) * spec * shine * shadow * (1.0 - cut * step(1.5, mat));
  if (face && mat > 2.5 && mat < 4.5) {
    // The chamfered rim of every tooth catches the light.
    float band = max(pix * 1.4, 0.01);
    float rim = smoothstep(-band, 0.0, orEdge);
    col += albedo * rim * lit * 0.42;
  }
  return col;
}

vec3 orRender(vec2 p, float pix, float t, vec2 ptr) {
  float elevation = mix(1.15, 0.5, orTiltAmount) + ptr.y * 0.16;
  float azimuth = ptr.x * 0.42 + sin(t * 0.05) * 0.06;
  vec3 target = vec3(0.0, -0.2, 0.0);
  float range = 6.0;
  vec3 ro = target + range * vec3(sin(azimuth) * cos(elevation), sin(elevation), cos(azimuth) * cos(elevation));
  vec3 fw = normalize(target - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float focal = range * 0.5 / 1.2;
  vec3 rd = normalize(fw * focal + rt * p.x + up * p.y);
  float footprint = pix / focal;

  // Night behind the instrument, a few faint stars.
  vec3 col = mix(vec3(0.008, 0.012, 0.04), vec3(0.02, 0.035, 0.09), smoothstep(-0.8, 0.6, p.y));
  vec2 g = p * 60.0;
  vec2 id = floor(g);
  float star = hash21(id + 7.3);
  if (star > 0.965) {
    float d = length(fract(g) - 0.5);
    col += vec3(0.6, 0.7, 1.0) * exp(-d * d * 30.0) * (0.35 + 0.3 * sin(t * (0.6 + star * 3.0) + star * 40.0));
  }

  // Enter the instrument's bounding sphere, or miss it.
  vec3 oc = ro - vec3(0.0, 0.2, 0.0);
  float b = dot(oc, rd);
  float c = dot(oc, oc) - 1.7 * 1.7;
  float h = b * b - c;
  float hitT = -1.0;
  vec2 hit = vec2(0.0);
  if (h > 0.0) {
    float s = sqrt(h);
    float far = -b + s;
    float march = max(-b - s, 0.0);
    for (int i = 0; i < 96; i++) {
      hit = orMap(ro + rd * march);
      if (hit.x < footprint * march * 0.3) {
        hitT = march;
        break;
      }
      march += hit.x * 0.9;
      if (march > far) {
        break;
      }
    }
  }
  if (hitT > 0.0) {
    vec3 pos = ro + rd * hitT;
    // Map once more at the hit so the gear globals belong to it.
    hit = orMap(pos);
    col = orSurface(pos, rd, hit.y, footprint * hitT);
  }

  // Glow round the sun, a little over anything in front of it.
  float along = dot(OR_SUN - ro, rd);
  float miss = length(ro + rd * along - OR_SUN) - OR_SUN_R;
  float front = hitT > 0.0 && hitT < along - OR_SUN_R ? 0.45 : 1.0;
  if (miss > 0.0) {
    col += vec3(1.0, 0.55, 0.18) * (exp(-miss * 7.0) * 0.12 + exp(-miss * 26.0) * 0.3) * orGlow * front;
  }
  return col;
}

vec2 orCacheUv = vec2(-1.0);
float orCacheT = -1.0;
vec4 orCacheValue = vec4(0.0);

vec4 orScene(vec2 uv, vec2 res, float t) {
  if (uv == orCacheUv && t == orCacheT) {
    return orCacheValue;
  }
  float aspect = res.x / res.y;
  float zoom = max(1.0, 1.21 / aspect);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * orParallax;

  // The centre wheel sets the pace; arms turn slower the further out.
  orTheta = (t + orDrive) * 0.32;
  float armA = orTheta * 1.9 + 0.6;
  float armB = orTheta * 1.0 + 2.5;
  float armC = orTheta * 0.55 + 4.3;
  float armMoon = orTheta * 5.0;
  orPlanetA = vec3(cos(armA) * 0.6, 0.23, sin(armA) * 0.6);
  orPlanetB = vec3(cos(armB) * 0.92, 0.3, sin(armB) * 0.92);
  orPlanetC = vec3(cos(armC) * 1.16, 0.36, sin(armC) * 1.16);
  orMoon = orPlanetC + vec3(cos(armMoon) * 0.17, 0.0, sin(armMoon) * 0.17);

  vec3 col = orRender(p, zoom / res.y, t, ptr);
  col = col / (1.0 + col * 0.3);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float tone = clamp((1.0 - exp(-lum * 3.0)) * 1.18 - 0.12, 0.0, 1.0);
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.42 + 0.58 * smoothstep(0.0, 0.8, peak));
  orCacheUv = uv;
  orCacheT = t;
  orCacheValue = vec4(ink, tone);
  return orCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return orScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return orScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its ink-blue night behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const NIGHT = "#04071a";
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
        "radial-gradient(circle at 50% 40%, #ffd27a 0 5%, #e0862e 7%, transparent 9%), radial-gradient(ellipse 46% 34% at 50% 56%, #7a5326 0 70%, #b8893f 72%, #3a2614 76%, transparent 77%), #04071a",
    }}
  />
);

// Drag: box widths per second of pointer travel to extra turns of the
// train, how fast it catches the hand, and how slowly it coasts back.
const DRAG_GAIN = 8;
const DRAG_FOLLOW = 0.12;
const COAST = 1.6;
const MAX_RATE = 14;

export interface OrrerySceneProps extends AsciiSceneProps {
  /** View angle, from 0 (nearly overhead) to 1 (low across the plate). Default 0.5. */
  tilt?: number;
  /** Glow round the sun, from 0 to 1.5. Default 1. */
  glow?: number;
  /** Depth of the engraved lines: orbits, bezel ticks and the rings cut into the wheels, from 0 to 1. Default 1. */
  engraving?: number;
  /** An engine pointer effect on top of the clockwork. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's ink-blue night in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Clockwork Orrery. A brass orrery seen at a three-quarter tilt: meshing
 * spur gears under a glowing sun drive concentric arms that carry a
 * planet, a ringed planet and a planet with its moon. Dragging sideways
 * winds the clockwork faster, or backwards, and it coasts back to its own
 * pace; hovering tilts the view.
 */
export const OrreryScene = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  speed = 1,
  animate = true,
  fps = 60,
  stillTime = 6,
  interactive = true,
  interaction = "none",
  tilt = 0.5,
  glow = 1,
  engraving = 1,
  fallback = FALLBACK,
  ref,
  ...props
}: OrrerySceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot: Ref<HTMLDivElement> = (node) => {
    rootRef.current = node;
    if (typeof ref === "function") {
      return ref(node);
    }
    if (ref) {
      ref.current = node;
    }
  };

  // The drag state lives outside React; `drive` is the extra phase the
  // hand has added, in field seconds.
  const spinRef = useRef({
    down: false,
    drive: 0,
    lastX: 0,
    pending: 0,
    pull: 0,
    rate: 1,
    width: 1,
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!(root && interactive)) {
      return;
    }
    const spin = spinRef.current;
    // The canvas ignores the pointer so content on top stays clickable;
    // presses are read off the window and kept if they land on the box.
    const onDown = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside || event.button !== 0) {
        return;
      }
      spin.down = true;
      spin.lastX = event.clientX;
      spin.pending = 0;
      spin.width = Math.max(1, rect.width);
    };
    const onMove = (event: PointerEvent) => {
      if (spin.down) {
        spin.pending += event.clientX - spin.lastX;
        spin.lastX = event.clientX;
      }
    };
    const onUp = () => {
      spin.down = false;
      spin.pending = 0;
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      spin.down = false;
      spin.rate = 1;
      spin.pull = 0;
    };
  }, [interactive]);

  useFrameLoop(
    (_, delta) => {
      const spin = spinRef.current;
      if (delta <= 0) {
        return;
      }
      if (spin.down) {
        const velocity = spin.pending / spin.width / delta;
        spin.pending = 0;
        spin.pull += (velocity - spin.pull) * (1 - Math.exp(-delta / 0.06));
        const target = 1 + spin.pull * DRAG_GAIN;
        spin.rate +=
          (target - spin.rate) * (1 - Math.exp(-delta / DRAG_FOLLOW));
      } else {
        spin.pull = 0;
        spin.rate += (1 - spin.rate) * (1 - Math.exp(-delta / COAST));
      }
      spin.rate = Math.min(MAX_RATE, Math.max(-MAX_RATE, spin.rate));
      // The shader's own clock already runs at 1x `speed`; add the rest.
      spin.drive += (spin.rate - 1) * delta * speed;
    },
    { enabled: animate && interactive, fps, target: rootRef }
  );

  // A fresh object each render carries the knobs; `orDrive` is a getter so
  // every frame reads the latest drag phase without a re-render.
  const uniforms = {
    get orDrive() {
      return spinRef.current.drive;
    },
    orEngrave: Math.min(1, Math.max(0, engraving)),
    orGlow: Math.max(0, glow),
    orParallax: interactive ? 1 : 0,
    orTiltAmount: Math.min(1, Math.max(0, tilt)),
  };

  return (
    <AsciiShader
      ref={setRoot}
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={uniforms}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      speed={speed}
      animate={animate}
      fps={fps}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};

"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

/** Where the aurora fades to paper so text on top stays clean. */
export type AuroraMask = "none" | "top" | "bottom" | "edges";

/** `up`: rays rise from a bright lower edge. `down`: they hang from the top. */
export type AuroraDirection = "up" | "down";

export interface AuroraProps extends AsciiSceneProps {
  /** The bright lower edge of each curtain. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The faint tops of the rays, in `truecolor` and `palette` modes. Default `"purple"`. */
  tipColor?: AsciiColor;
  /** The sky behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the edge colour last. Wins over `ink`, `tipColor` and `paper`. */
  palette?: AsciiPalette;
  /** Number of curtains, 1 to 6. Default 3. */
  curtains?: number;
  /** Where the lowest bright edge hangs, 0 (bottom) to 1 (top). Default 0.42. */
  height?: number;
  /** Vertical gap between curtains, 0 to 0.3. Default 0.11. */
  spread?: number;
  /** How far the edges fold, 0 (straight) to 3. Default 1. */
  sway?: number;
  /** Fine ripples along the edges, 0 to 2. Default 0.6. */
  turbulence?: number;
  /** How many rays fit across, 2 (broad bands) to 20 (fine needles). Default 8. */
  rays?: number;
  /** How far the rays reach up, 0 (short) to 1 (long). Default 0.45. */
  length?: number;
  /** Brightness of the edge line, 0 to 2. Default 1. */
  glow?: number;
  /** Brightness of the curtains, 0 to 1. Default 0.95. */
  intensity?: number;
  /** Slow brightness ripple, 0 to 1. Default 0.2. */
  shimmer?: number;
  /** Horizontal zoom: higher values fit more folds across. Default 1. */
  scale?: number;
  /** Tilt of the curtains in degrees, -45 to 45. Default 0. */
  tilt?: number;
  /** Sideways travel, -2 (left) to 2 (right). Default 0. */
  drift?: number;
  /** Which way the rays point. Default `"up"`. */
  direction?: AuroraDirection;
  /** Fade it out where text sits. Default `"none"`. */
  mask?: AuroraMask;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

const MASKS = {
  bottom: 2,
  edges: 3,
  none: 0,
  top: 1,
} as const satisfies Record<AuroraMask, number>;

// auroraLight returns the tone and how far up its ray the light sits (0 at
// the edge, 1 at the tip), so the colour field can shade by height without
// a second copy of the curtain maths.
const FIELD = `
vec2 auroraLight(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  if (auroraFlip > 0.5) {
    p.y = -p.y;
  }
  float c = cos(auroraTilt);
  float s = sin(auroraTilt);
  p = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) + vec2(0.0, 0.5);
  float x = p.x * auroraScale + t * auroraDrift * 0.04;
  float decayBase = mix(10.0, 1.6, auroraLength);
  float light = 0.0;
  float rise = 0.0;
  float weight = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= auroraCurtains) {
      break;
    }
    float depth = fi / max(auroraCurtains - 1.0, 1.0);
    float edge = auroraHeight + fi * auroraSpread
      + auroraSway * 0.11 * snoise(vec2(x * 0.55 + fi * 3.1, t * 0.035 + fi * 1.7))
      + auroraTurbulence * 0.05 * snoise(vec2(x * 2.1 - fi * 1.3, t * 0.07 + fi));
    float above = p.y - edge;
    float curtain = above > 0.0
      ? exp(-above * decayBase * (1.0 + fi * 0.4))
      : exp(above * 48.0);
    float bend = snoise(vec2(x * 0.8, t * 0.03 + fi)) * (0.25 + 0.35 * auroraSway);
    float rx = (x + bend) * auroraRays;
    // Hard-edged rays: glyph ramps need clear steps between lit and dark.
    // Which stretches of the curtain are lit, then narrow streaks inside
    // them. A streak's tone falls with height, so wherever a charset draws
    // by threshold (Braille, quadrants) it becomes a ray of its own length,
    // and ramp charsets shade it from dense to light.
    float rays = smoothstep(0.38, 0.66, fbm(vec2(rx + fi * 9.0, t * 0.045 + fi)));
    float streak = 0.5 + 0.5 * snoise(vec2(rx * 5.0, fi * 4.0 + t * 0.02));
    streak *= streak;
    float patch = mix(0.4, 1.0, smoothstep(0.3, 0.65, fbm(vec2(x * 0.45 + fi * 5.0, t * 0.02 + fi * 2.0))));
    // A thin rim in box terms, but never under about one sample row, so a
    // coarse charset still draws it as one unbroken line of glyphs.
    float rim = exp(-abs(above) / max(0.011, 1.1 / res.y)) * auroraGlow;
    float haze = above > 0.0 ? exp(-above * 5.0) * 0.05 : 0.0;
    float body = curtain * rays * (0.3 + 1.5 * streak);
    // The rim skips the patch dimming, so the edge stays one unbroken line.
    float fade = mix(1.0, 0.6, depth);
    float lit = (body + haze) * patch * fade + rim * (0.75 + 0.25 * rays) * fade;
    light += lit;
    rise += lit * clamp(above * decayBase * 0.35, 0.0, 1.0);
    weight += lit;
  }
  float ripple = 0.5 + 0.5 * sin(t * 0.8 + p.x * 4.0 + 2.0 * snoise(vec2(p.x * 2.5, t * 0.15)));
  // Faint haze drops to clean paper, so glyph ramps keep open sky between
  // the rays instead of a field of dots.
  float tone = smoothstep(0.06, 1.0, 1.0 - exp(-light * 1.5)) * auroraIntensity * (1.0 - auroraShimmer * 0.45 * ripple);

  float keep = 1.0;
  if (auroraMask > 2.5) {
    keep = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);
  } else if (auroraMask > 1.5) {
    keep = smoothstep(0.02, 0.4, uv.y);
  } else if (auroraMask > 0.5) {
    keep = smoothstep(0.98, 0.6, uv.y);
  }
  return vec2(tone * keep, rise / max(weight, 1e-4));
}

float field(vec2 uv, vec2 res, float t) {
  return auroraLight(uv, res, t).x;
}
`;

// Edge colour at the bright lower edge, tip colour as the rays fade.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float rise = auroraLight(uv, res, t).y;
  return paletteColor(1.0 - smoothstep(0.0, 0.85, rise)).rgb;
}
`;

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const DIRECTIONS = {
  down: { flip: 1, gradient: "to bottom" },
  up: { flip: 0, gradient: "to top" },
} as const satisfies Record<
  AuroraDirection,
  { flip: number; gradient: string }
>;

/** A CSS glow along the lowest edge, shown without WebGL. */
const AuroraFallback = ({
  palette,
  height,
  direction,
}: {
  palette: AsciiPalette;
  height: number;
  direction: AuroraDirection;
}) => {
  const edge = cssColor(palette.at(-1) ?? palette[1]);
  const tip = cssColor(palette[1]);
  const at = `${(clamp(height, 0, 1) * 100).toFixed(1)}%`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: `linear-gradient(${DIRECTIONS[direction].gradient}, transparent ${at}, color-mix(in oklch, ${edge} 50%, transparent) calc(${at} + 2%), color-mix(in oklch, ${tip} 20%, transparent) calc(${at} + 18%), transparent 85%)`,
      }}
    />
  );
};

/** The shape props, as the shader's uniforms. */
type AuroraShape = Pick<
  AuroraProps,
  | "curtains"
  | "height"
  | "spread"
  | "sway"
  | "turbulence"
  | "rays"
  | "length"
  | "glow"
  | "intensity"
  | "shimmer"
  | "scale"
  | "tilt"
  | "drift"
  | "direction"
  | "mask"
>;

const auroraUniforms = ({
  curtains = 3,
  height = 0.42,
  spread = 0.11,
  sway = 1,
  turbulence = 0.6,
  rays = 8,
  length = 0.45,
  glow = 1,
  intensity = 0.95,
  shimmer = 0.2,
  scale = 1,
  tilt = 0,
  drift = 0,
  direction = "up",
  mask = "none",
}: AuroraShape) => ({
  auroraCurtains: clamp(Math.round(curtains), 1, 6),
  auroraDrift: clamp(drift, -2, 2),
  auroraFlip: DIRECTIONS[direction].flip,
  auroraGlow: clamp(glow, 0, 2),
  auroraHeight: height,
  auroraIntensity: clamp(intensity, 0, 1),
  auroraLength: clamp(length, 0, 1),
  auroraMask: MASKS[mask],
  auroraRays: clamp(rays, 1, 32),
  auroraScale: Math.max(0.1, scale),
  auroraShimmer: clamp(shimmer, 0, 1),
  auroraSpread: clamp(spread, 0, 0.5),
  auroraSway: Math.max(0, sway),
  auroraTilt: (clamp(tilt, -45, 45) * Math.PI) / 180,
  auroraTurbulence: Math.max(0, turbulence),
});

/**
 * Curtains of light drawn in glyphs: each has a bright folded edge and
 * rays that fade up into a second colour. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const Aurora = ({
  ink = "--ascii-ink",
  tipColor = "purple",
  paper = "--ascii-paper",
  palette,
  curtains,
  height = 0.42,
  spread,
  sway,
  turbulence,
  rays,
  length,
  glow,
  intensity,
  shimmer,
  scale,
  tilt,
  drift,
  direction = "up",
  mask,
  charset = "braille",
  colorMode = "truecolor",
  dither = "blue-noise",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 6,
  ...props
}: AuroraProps) => {
  const colors = palette ?? [paper, tipColor, ink];

  return (
    <AsciiShader
      {...props}
      charset={charset}
      dither={dither}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, colors.at(-1) ?? ink, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={auroraUniforms({
        curtains,
        direction,
        drift,
        glow,
        height,
        intensity,
        length,
        mask,
        rays,
        scale,
        shimmer,
        spread,
        sway,
        tilt,
        turbulence,
      })}
      fallback={
        <AuroraFallback
          palette={colors}
          height={height}
          direction={direction}
        />
      }
    />
  );
};

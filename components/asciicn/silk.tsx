"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface SilkProps extends AsciiSceneProps {
  /** The colour of the lit cloth. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The colour of folds turned away from the light. Default `"purple"`. */
  shadeColor?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the highlight last. Wins over `ink`, `shadeColor` and `paper`. */
  palette?: AsciiPalette;
  /** How many folds cross the box. Default 6. */
  folds?: number;
  /** Direction the folds run, in degrees as in CSS: 90 runs them left to right. Default 110. */
  angle?: number;
  /** How narrow and bright the highlight on each crest is, 0 to 1. Default 0.6. */
  sheen?: number;
  /** The brightest tone, 0 to 1. Lower it to sit text on top. Default 1. */
  intensity?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

/**
 * The cloth is a height field of folds bent by slow waves, lit from the
 * top left. `silkLight` returns the tone in x and how squarely the cloth
 * faces the light in y (0 turned away, 1 facing), for the colour.
 */
const FIELD = `
float silkHeight(vec2 p, float t) {
  float bend = 0.55 * sin(p.x * 0.9 + t * 0.09)
    + 0.3 * sin(p.x * 1.7 - p.y * 0.4 + t * 0.06 + 1.3)
    + 0.35 * snoise(p * 0.35 + vec2(t * 0.015, 0.0));
  float across = (p.y + bend) * silkFolds * 0.9;
  // Uneven folds: some pleats bunch up, others hang wide.
  across += 0.6 * sin(across * 0.5 + p.x * 0.3 + t * 0.04);
  return sin(across + 0.4 * sin(p.x * 0.7 - t * 0.05));
}

vec2 silkLight(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 c = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * 3.2;
  float a = radians(silkAngle - 90.0);
  vec2 p = mat2(cos(a), sin(a), -sin(a), cos(a)) * c;

  // Finite differences one sample row apart, at any charset's sampling.
  float e = 3.2 / res.y;
  float h = silkHeight(p, t);
  float hx = silkHeight(p + vec2(e, 0.0), t);
  float hy = silkHeight(p + vec2(0.0, e), t);
  // Divide by the fold count so more folds don't mean steeper ones.
  vec2 grad = vec2(hx - h, hy - h) / e / max(silkFolds, 0.5);
  vec3 n = normalize(vec3(-grad * 1.4, 1.0));

  vec3 light = normalize(vec3(-0.45, 0.65, 0.6));
  float facing = 0.5 + 0.5 * dot(n, light);
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float shine = pow(max(dot(n, halfway), 0.0), mix(6.0, 48.0, silkSheen));
  // Steep sides of a fold get a thin rim, so each crest reads as an edge
  // of glyphs rather than a soft blur.
  float rim = smoothstep(0.55, 0.95, length(grad)) * 0.18;

  // The light falls off across the cloth, so one side sits in shadow.
  float pool = smoothstep(-0.6, 0.9, snoise(c * 0.3 + vec2(t * 0.012, 0.4)) * 0.6 + 0.3 * c.y);
  float tone = pow(smoothstep(0.28, 1.0, facing), 1.7) * 0.7 + shine * mix(0.45, 0.85, silkSheen) + rim;
  return vec2(clamp(tone * mix(0.5, 1.0, pool), 0.0, 1.0) * silkIntensity, facing * pool);
}

float field(vec2 uv, vec2 res, float t) {
  return silkLight(uv, res, t).x;
}
`;

// Faces turned away take the shade colour; faces to the light climb to
// the highlight.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 lit = silkLight(uv, res, t);
  return paletteColor(clamp(lit.y * 0.7 + lit.x * 0.45, 0.0, 1.0)).rgb;
}
`;

/** Ink and paper for the shader, unless a phosphor brings its own. */
const glass = (
  phosphor: string | undefined,
  ink: AsciiColor,
  paper: AsciiColor
): { ink?: AsciiColor; paper?: AsciiColor } =>
  phosphor === undefined ? { ink, paper } : {};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** `color` mixed into `base` at `share` percent. */
const mix = (color: AsciiColor, share: number, base: AsciiColor) =>
  `color-mix(in oklch, ${cssColor(color)} ${share}%, ${cssColor(base)})`;

/** Soft diagonal sheens in CSS, shown without WebGL. */
const SilkFallback = ({
  palette,
  angle,
}: {
  palette: AsciiPalette;
  angle: number;
}) => {
  const top = cssColor(palette.at(-1) ?? palette[1]);
  const mid = cssColor(palette[1]);
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: `repeating-linear-gradient(${angle}deg, transparent 0, color-mix(in oklab, ${mid} 35%, transparent) 12%, color-mix(in oklab, ${top} 30%, transparent) 15%, transparent 25%)`,
      }}
    />
  );
};

/**
 * Folds of silk catching the light, drawn in glyphs: smooth sheets that
 * shift and slide, with a bright highlight along each crest. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Silk = ({
  ink = "--ascii-ink",
  shadeColor = "purple",
  paper = "--ascii-paper",
  palette,
  folds = 6,
  angle = 110,
  sheen = 0.6,
  intensity = 1,
  charset = "blocks",
  colorMode = "palette",
  cell = 12,
  interaction = "none",
  interactive = true,
  stillTime = 7,
  ...props
}: SilkProps) => {
  const colors = palette ?? [
    paper,
    mix(shadeColor, 45, paper),
    mix(ink, 70, paper),
    ink,
  ];

  return (
    <AsciiShader
      {...props}
      cell={cell}
      charset={charset}
      colorMode={colorMode}
      {...glass(props.phosphor, colors.at(-1) ?? ink, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={{
        silkAngle: angle,
        silkFolds: Math.max(0.5, folds),
        silkIntensity: clamp(intensity, 0, 1),
        silkSheen: clamp(sheen, 0, 1),
      }}
      fallback={<SilkFallback palette={colors} angle={angle} />}
    />
  );
};

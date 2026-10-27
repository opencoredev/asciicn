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

/** Where the field fades out so text on top stays clean. */
export type NoiseFieldMask = "none" | "center" | "top" | "bottom" | "edges";

/**
 * The shape of the texture. `smoke` is soft folding fbm, `ridges` sharp
 * creases, `contours` topographic lines, `marble` warped stripes.
 */
export type NoiseFieldVariant = "smoke" | "ridges" | "contours" | "marble";

export interface NoiseFieldProps extends AsciiSceneProps {
  /** The glyph colour. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /**
   * A second colour. In `palette` mode it takes the brightest peaks; in
   * `truecolor` mode the warp swirls between `ink` and it, like marbled
   * paper. Default: none, so one colour.
   */
  highlight?: AsciiColor;
  /** The paper behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once: paper, then the glyph colours. Wins over `ink`, `highlight` and `paper`. */
  palette?: AsciiPalette;
  /** The shape of the texture. Default `"smoke"`. */
  variant?: NoiseFieldVariant;
  /** Size of the features. Higher values give smaller, busier noise. Default 0.8. */
  scale?: number;
  /** How far the noise folds back on itself, 0 (plain fbm) to 4. Default 1.7. */
  warp?: number;
  /** Octaves of noise, 1 (blobs) to 6 (fine grain on top). Default 3. */
  detail?: number;
  /** Contrast of the texture. 1 is soft; 2 and up give hard-edged islands. Default 1.5. */
  contrast?: number;
  /** Shifts how much of the box is inked, -0.5 (sparse) to 0.5 (dense). Default 0. */
  coverage?: number;
  /** Brightest tone the field reaches, 0 to 1. Default 0.9. */
  intensity?: number;
  /** Lines per unit of height for `contours`, stripes for `marble`, 2 to 24. Default 8. */
  bands?: number;
  /** Direction the texture drifts in, in degrees. 0 is right, 90 up. Default 90. */
  angle?: number;
  /** How fast it drifts along `angle`, 0 to 4. Default 1. */
  flow?: number;
  /** Fade the field out where text sits. Default `"none"`. */
  mask?: NoiseFieldMask;
  /** How much of the box the mask clears, 0 to 1. Default 0.5. */
  maskSize?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

const MASKS = {
  bottom: 3,
  center: 1,
  edges: 4,
  none: 0,
  top: 2,
} as const satisfies Record<NoiseFieldMask, number>;

const VARIANTS = {
  contours: 2,
  marble: 3,
  ridges: 1,
  smoke: 0,
} as const satisfies Record<NoiseFieldVariant, number>;

const FIELD = `
const mat2 NOISE_FIELD_ROTATE = mat2(0.8, -0.6, 0.6, 0.8);

float noiseFieldFbm(vec2 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= octaves) {
      break;
    }
    sum += amp * snoise(p);
    norm += amp;
    p = NOISE_FIELD_ROTATE * p * 2.02 + vec2(11.3, 4.7);
    amp *= 0.5;
  }
  return clamp(0.5 + 0.5 * sum / norm, 0.0, 1.0);
}

float noiseFieldRidges(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= noiseFieldDetail) {
      break;
    }
    float r = 1.0 - abs(snoise(p));
    sum += amp * r * r;
    norm += amp;
    p = NOISE_FIELD_ROTATE * p * 2.02 + vec2(11.3, 4.7);
    amp *= 0.5;
  }
  return sum / norm;
}

// The texture tone (x) and the first warp channel (y), which the colour
// field uses to swirl between the two inks.
vec2 noiseFieldSample(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * noiseFieldScale;
  vec2 drift = vec2(cos(noiseFieldAngle), sin(noiseFieldAngle)) * t * 0.05 * noiseFieldFlow;
  vec2 q = vec2(
    noiseFieldFbm(p + vec2(0.0, t * 0.02) - drift, noiseFieldDetail),
    noiseFieldFbm(p + vec2(5.2, 1.3) - vec2(t * 0.015, 0.0) - drift * 0.8, noiseFieldDetail)
  );
  vec2 w = p + noiseFieldWarp * q - drift * 0.6;

  float n;
  if (noiseFieldVariant > 2.5) {
    float s = sin(dot(w, vec2(0.35, 1.0)) * noiseFieldBands * 2.4 + noiseFieldFbm(w * 0.7, noiseFieldDetail) * 2.5);
    n = pow(0.5 + 0.5 * s, 1.6);
  } else if (noiseFieldVariant > 1.5) {
    // Lines need a smooth height, so the finest octaves stay out of it.
    float h = noiseFieldFbm(p * 0.6 + noiseFieldWarp * 0.3 * q - drift * 0.6, min(noiseFieldDetail, 2.0));
    float d = abs(fract(h * noiseFieldBands) - 0.5);
    n = max(smoothstep(0.38, 0.47, d), h * h * 0.2);
  } else if (noiseFieldVariant > 0.5) {
    n = pow(noiseFieldRidges(w), 1.4);
  } else {
    n = noiseFieldFbm(w, noiseFieldDetail);
  }

  if (noiseFieldVariant < 1.5 || noiseFieldVariant > 2.5) {
    // Smoke keeps a gentle slope so the folds stay a gradient, not plateaus.
    float slope = noiseFieldVariant < 0.5 ? 1.0 : 1.5;
    n = clamp((n - 0.5 + noiseFieldCoverage) * noiseFieldContrast * slope + 0.5, 0.0, 1.0);
    n = n * n * (3.0 - 2.0 * n);
  } else {
    n = clamp(n + noiseFieldCoverage, 0.0, 1.0);
  }
  if (noiseFieldVariant < 0.5) {
    n = pow(n, 1.8);
  }

  float keep = 1.0;
  float size = noiseFieldMaskSize;
  if (noiseFieldMask > 3.5) {
    vec2 d = vec2((uv.x - 0.5) * 0.85, (uv.y - 0.5) * 1.7);
    float r = 0.2 + 0.45 * (1.0 - size);
    keep = 1.0 - smoothstep(r, r + 0.4, length(d));
  } else if (noiseFieldMask > 2.5) {
    keep = smoothstep(size * 0.8, size * 0.8 + 0.55, uv.y);
  } else if (noiseFieldMask > 1.5) {
    keep = smoothstep(size * 0.8, size * 0.8 + 0.55, 1.0 - uv.y);
  } else if (noiseFieldMask > 0.5) {
    vec2 d = vec2((uv.x - 0.5) * 0.85, (uv.y - 0.5) * 1.7);
    float r = 0.36 * size;
    keep = smoothstep(r, r + 0.44, length(d));
  }
  return vec2(n * keep * noiseFieldIntensity, q.x);
}

float field(vec2 uv, vec2 res, float t) {
  return noiseFieldSample(uv, res, t).x;
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float swirl = noiseFieldSample(uv, res, t).y;
  return paletteColor(smoothstep(0.3, 0.7, swirl)).rgb;
}
`;

const FALLBACK_MASKS = {
  bottom: "linear-gradient(to top, transparent 5%, black 60%)",
  center: "radial-gradient(ellipse 60% 45% at 50% 50%, transparent 30%, black)",
  edges: "radial-gradient(ellipse 60% 55% at 50% 50%, black 30%, transparent)",
  none: "none",
  top: "linear-gradient(to bottom, transparent 5%, black 60%)",
} as const satisfies Record<NoiseFieldMask, string>;

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The texture props, as the shader's uniforms. */
type NoiseFieldShape = Pick<
  NoiseFieldProps,
  | "variant"
  | "scale"
  | "warp"
  | "detail"
  | "contrast"
  | "coverage"
  | "intensity"
  | "bands"
  | "angle"
  | "flow"
  | "mask"
  | "maskSize"
>;

const noiseFieldUniforms = ({
  variant = "smoke",
  scale = 0.8,
  warp = 1.7,
  detail = 3,
  contrast = 1.5,
  coverage = 0,
  intensity = 0.9,
  bands = 8,
  angle = 90,
  flow = 1,
  mask = "none",
  maskSize = 0.5,
}: NoiseFieldShape) => ({
  noiseFieldAngle: (angle * Math.PI) / 180,
  noiseFieldBands: clamp(bands, 1, 48),
  noiseFieldContrast: Math.max(0, contrast),
  noiseFieldCoverage: clamp(coverage, -1, 1),
  noiseFieldDetail: clamp(Math.round(detail), 1, 6),
  noiseFieldFlow: Math.max(0, flow),
  noiseFieldIntensity: clamp(intensity, 0, 1),
  noiseFieldMask: MASKS[mask],
  noiseFieldMaskSize: clamp(maskSize, 0, 1),
  noiseFieldScale: Math.max(0.1, scale),
  noiseFieldVariant: VARIANTS[variant],
  noiseFieldWarp: Math.max(0, warp),
});

/**
 * A slow, folding noise texture drawn in glyphs, for a quiet surface
 * behind content. `variant` changes its shape, `mask` clears the area
 * where your text sits. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const NoiseField = ({
  ink = "--ascii-ink",
  highlight,
  paper = "--ascii-paper",
  palette,
  variant,
  scale,
  warp,
  detail,
  contrast,
  coverage,
  intensity,
  bands,
  angle,
  flow,
  mask = "none",
  maskSize,
  charset = "standard",
  colorMode = "palette",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  ...props
}: NoiseFieldProps) => {
  const colors: AsciiPalette =
    palette ??
    (highlight === undefined ? [paper, ink] : [paper, ink, highlight]);
  const fallbackInk = cssColor(colors[1]);
  const fallbackMask = FALLBACK_MASKS[mask];

  return (
    <AsciiShader
      {...props}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, colors[1], colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      uniforms={noiseFieldUniforms({
        angle,
        bands,
        contrast,
        coverage,
        detail,
        flow,
        intensity,
        mask,
        maskSize,
        scale,
        variant,
        warp,
      })}
      fallback={
        <div
          className="absolute inset-0"
          style={{ backgroundColor: cssColor(colors[0]) }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              WebkitMaskImage: fallbackMask,
              backgroundImage: `radial-gradient(circle at 25% 30%, ${fallbackInk}, transparent 45%), radial-gradient(circle at 75% 70%, ${fallbackInk}, transparent 40%)`,
              maskImage: fallbackMask,
            }}
          />
        </div>
      }
    />
  );
};

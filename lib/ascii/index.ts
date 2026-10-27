/**
 * ascii-core: the shared engine behind every asciicn component.
 * Import from `@/lib/ascii`.
 */

export {
  BAYER_2,
  BAYER_4,
  BAYER_8,
  BLUE_NOISE_64,
  DITHER_MATRICES,
  getThresholdMap,
  isInked,
  thresholdAt,
} from "@/lib/ascii/matrices";
export type { DitherMatrix, ThresholdMap } from "@/lib/ascii/matrices";

export {
  cssColor,
  DEFAULT_PALETTE,
  ASCII_COLOR_NAMES,
  ASCII_COLORS,
  MOTION,
} from "@/lib/ascii/tokens";
export type {
  AsciiColor,
  AsciiColorName,
  AsciiPalette,
  Rgba,
} from "@/lib/ascii/tokens";

export {
  BLOOM_LEVELS,
  BLOOMS,
  bloomFilter,
  bloomLayerStyle,
  bloomStyle,
  asciiRamp,
  FILL_VARIANTS,
  fillStyle,
  fillTile,
  SERIES_COLORS,
  seriesColor,
} from "@/lib/ascii/style";
export type {
  Bloom,
  FillEdge,
  FillStyleOptions,
  FillTile,
  FillVariant,
  RampOptions,
  RampTile,
} from "@/lib/ascii/style";

export {
  readAsciiCell,
  resolveColor,
  subscribeToTheme,
  useAsciiColors,
} from "@/lib/ascii/color";

export {
  useDocumentVisible,
  useFrameLoop,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii/motion";
export type {
  FrameLoopCallback,
  FrameLoopOptions,
  FrameLoopState,
} from "@/lib/ascii/motion";

export { AsciiShader, MAX_LIVE_CONTEXTS } from "@/lib/ascii/shader";
export type {
  AsciiShaderProps,
  AsciiShaderState,
  AsciiUniforms,
  ShaderUniformValue,
} from "@/lib/ascii/shader";

export { BloomBox, BloomGroup, FillPattern } from "@/lib/ascii/fill";
export type {
  BloomBoxProps,
  BloomGroupProps,
  FillPatternProps,
  FillRamp,
} from "@/lib/ascii/fill";

export {
  AsciiPattern,
  asciiMask,
  asciiMaskStyle,
  asciiPath,
} from "@/lib/ascii/pattern";
export type {
  AsciiMaskOptions,
  AsciiMaskStyleOptions,
  AsciiPatternProps,
} from "@/lib/ascii/pattern";

export { DITHER_METHODS, ditherImage } from "@/lib/ascii/diffuse";
export type {
  DiffuseOptions,
  DiffusionMethod,
  DiffusionOptions,
  DitherMethod,
  ImagePalette,
  OrderedMethod,
  OrderedOptions,
  PaletteColor,
  PixelBuffer,
} from "@/lib/ascii/diffuse";

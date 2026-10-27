/**
 * ascii-core: the CPU side of the asciicn engine, shared by every
 * component. Import from `@/lib/ascii`.
 *
 * The WebGL2 renderer lives in `@/lib/ascii/shader` (the ascii-shader
 * registry item), so components that only draw text, charts or interface
 * pieces never ship WebGL code.
 */

export * from "@/lib/ascii/charsets";
export * from "@/lib/ascii/palettes";
export * from "@/lib/ascii/frame";
export * from "@/lib/ascii/measure";
export * from "@/lib/ascii/grid";
export * from "@/lib/ascii/look";
export * from "@/lib/ascii/scene";

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
  ASCII_COLOR_NAMES,
  ASCII_COLORS,
  cssColor,
  DEFAULT_PALETTE,
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

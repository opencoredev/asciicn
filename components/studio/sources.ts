/**
 * The Studio's source catalog: what each source is called, which registry
 * item it exports as, the look it starts with, and how to load it. Every
 * component loads on demand, so the Studio only downloads what is on the
 * stage.
 */

import type { ComponentType } from "react";

import type {
  FieldSourceId,
  MediaSourceId,
  SceneSourceId,
  SourceId,
} from "@/components/studio/source-ids";
import type { LookOverrides } from "@/components/studio/state";
import type { AudioBands } from "@/lib/ascii/audio";
import type { AsciiLook, Interaction } from "@/lib/ascii/look";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { SCENES } from "@/lib/scenes";

/**
 * Props the Studio hands every component source: the look plus motion and
 * export, and nothing else, so any component with these props fits.
 */
export interface StudioRenderProps
  extends
    AsciiLook,
    Pick<
      AsciiSceneProps,
      "cell" | "speed" | "animate" | "fps" | "handle" | "className"
    > {
  interaction?: Interaction;
  audio?: AudioBands | null;
  /** Mono ink as a CSS colour, for a custom phosphor. */
  ink?: string;
  /** Mono paper as a CSS colour, for a phosphor's glass. */
  paper?: string;
  /** Seeded backgrounds only. */
  seed?: string;
}

export type StudioComponent = ComponentType<StudioRenderProps>;

interface SourceBase {
  readonly label: string;
  /** One line under the label. */
  readonly hint: string;
  /** Registry item name, for `npx shadcn@latest add`. */
  readonly registry: string;
  /** The exported component, for the JSX snippet. */
  readonly importName: string;
  readonly importPath: string;
  /** The look the component draws by default. */
  readonly defaults: LookOverrides;
}

export type FieldSource = SourceBase & {
  readonly kind: "field";
  /** Takes a `seed` string that reshapes the whole field. */
  readonly seeded: boolean;
  readonly id: FieldSourceId;
  readonly group: "backgrounds" | "objects";
  /** `null` while the component hasn't shipped yet. */
  readonly load: (() => Promise<StudioComponent>) | null;
};

export type SceneSource = SourceBase & {
  readonly kind: "scene";
  readonly id: SceneSourceId;
  readonly group: "scenes";
  readonly load: () => Promise<StudioComponent>;
};

export type MediaSource = SourceBase & {
  readonly kind: "media";
  readonly id: MediaSourceId;
  readonly group: "media";
};

export type StudioSource = FieldSource | SceneSource | MediaSource;

export const SOURCE_GROUPS = [
  { id: "backgrounds", label: "Backgrounds" },
  { id: "objects", label: "3D objects" },
  { id: "scenes", label: "Scenes" },
  { id: "media", label: "Media" },
] as const;

const FIELD_SOURCES: readonly FieldSource[] = [
  {
    defaults: { cell: 12, charset: "blocks", colorMode: "native" },
    group: "backgrounds",
    hint: "Folds of cloth catching the light",
    id: "silk",
    importName: "Silk",
    importPath: "@/components/asciicn/silk",
    kind: "field",
    label: "Silk",
    load: async () => {
      const { Silk } = await import("@/components/asciicn/silk");
      return Silk;
    },
    registry: "silk",
    seeded: false,
  },
  {
    defaults: { charset: "dense", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Gas clouds lit from within",
    id: "nebula",
    importName: "Nebula",
    importPath: "@/components/asciicn/nebula",
    kind: "field",
    label: "Nebula",
    load: async () => {
      const { Nebula } = await import("@/components/asciicn/nebula");
      return Nebula;
    },
    registry: "nebula",
    seeded: true,
  },
  {
    defaults: { cell: 12, charset: "blocks", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Interfering sine blobs",
    id: "plasma",
    importName: "Plasma",
    importPath: "@/components/asciicn/plasma",
    kind: "field",
    label: "Plasma",
    load: async () => {
      const { Plasma } = await import("@/components/asciicn/plasma");
      return Plasma;
    },
    registry: "plasma",
    seeded: false,
  },
  {
    defaults: { charset: "dense", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Seeded refracting ribbons",
    id: "prism",
    importName: "Prism",
    importPath: "@/components/asciicn/prism",
    kind: "field",
    label: "Prism",
    load: async () => {
      const { Prism } = await import("@/components/asciicn/prism");
      return Prism;
    },
    registry: "prism",
    seeded: true,
  },
  {
    defaults: { charset: "braille", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Seeded charged filaments",
    id: "ionize",
    importName: "Ionize",
    importPath: "@/components/asciicn/ionize",
    kind: "field",
    label: "Ionize",
    load: async () => {
      const { Ionize } = await import("@/components/asciicn/ionize");
      return Ionize;
    },
    registry: "ionize",
    seeded: true,
  },
  {
    defaults: { charset: "standard", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Seeded gusts and squalls",
    id: "squall",
    importName: "Squall",
    importPath: "@/components/asciicn/squall",
    kind: "field",
    label: "Squall",
    load: async () => {
      const { Squall } = await import("@/components/asciicn/squall");
      return Squall;
    },
    registry: "squall",
    seeded: true,
  },
  {
    defaults: { charset: "blocks", colorMode: "truecolor" },
    group: "backgrounds",
    hint: "Seeded soft sheen",
    id: "satin",
    importName: "Satin",
    importPath: "@/components/asciicn/satin",
    kind: "field",
    label: "Satin",
    load: async () => {
      const { Satin } = await import("@/components/asciicn/satin");
      return Satin;
    },
    registry: "satin",
    seeded: true,
  },
  {
    defaults: { cell: 10, charset: "standard", colorMode: "truecolor" },
    group: "objects",
    hint: "A spinning, lit torus",
    id: "torus-3d",
    importName: "AsciiDonut",
    importPath: "@/components/asciicn/ascii-donut",
    kind: "field",
    label: "Torus",
    load: async () => {
      const { AsciiDonut } = await import("@/components/asciicn/ascii-donut");
      return AsciiDonut;
    },
    registry: "ascii-donut",
    seeded: false,
  },
  {
    defaults: { cell: 10, charset: "braille", colorMode: "truecolor" },
    group: "objects",
    hint: "A lit, rotating Earth",
    id: "globe-3d",
    importName: "AsciiGlobe",
    importPath: "@/components/asciicn/ascii-globe",
    kind: "field",
    label: "Globe",
    load: async () => {
      const { AsciiGlobe } = await import("@/components/asciicn/ascii-globe");
      return AsciiGlobe;
    },
    registry: "ascii-globe",
    seeded: false,
  },
];

const pascal = (id: string) =>
  id
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const SCENE_TITLES: Readonly<Record<SceneSourceId, string>> = {
  "circuit-bloom-scene": "Circuit bloom",
  "fluid-smoke-scene": "Smoke",
  "hourglass-scene": "Hourglass",
  "morphogenesis-scene": "Morphogenesis",
  "murmuration-scene": "Murmuration",
  "orrery-scene": "Orrery",
  "sacred-torus-scene": "Torus knot",
  "synthwave-horizon-scene": "Synthwave",
  "tempest-storm-scene": "Tempest",
  "terminal-deck-scene": "Cyberdeck",
  "warp-tunnel-scene": "Warp tunnel",
  "woven-banner-scene": "Woven banner",
};

/** Each scene's own charset, so the snippet and the stage agree. */
const SCENE_DEFAULTS: Readonly<Record<SceneSourceId, LookOverrides>> = {
  "circuit-bloom-scene": { charset: "braille", colorMode: "truecolor" },
  "fluid-smoke-scene": { charset: "braille", colorMode: "truecolor" },
  "hourglass-scene": { charset: "dense", colorMode: "truecolor" },
  "morphogenesis-scene": { charset: "braille", colorMode: "truecolor" },
  "murmuration-scene": { charset: "braille", colorMode: "truecolor" },
  "orrery-scene": { charset: "standard", colorMode: "truecolor" },
  "sacred-torus-scene": { charset: "standard", colorMode: "truecolor" },
  "synthwave-horizon-scene": { charset: "braille", colorMode: "truecolor" },
  "tempest-storm-scene": { charset: "standard", colorMode: "truecolor" },
  "terminal-deck-scene": {
    cell: 14,
    charset: "braille",
    colorMode: "truecolor",
  },
  "warp-tunnel-scene": { charset: "standard", colorMode: "truecolor" },
  "woven-banner-scene": { charset: "standard", colorMode: "truecolor" },
};

const isSceneId = (id: string): id is SceneSourceId =>
  Object.hasOwn(SCENE_TITLES, id);

const SCENE_SOURCES: readonly SceneSource[] = SCENES.flatMap((scene) =>
  isSceneId(scene.id)
    ? [
        {
          defaults: SCENE_DEFAULTS[scene.id],
          group: "scenes",
          hint: scene.title,
          id: scene.id,
          importName: pascal(scene.id),
          importPath: `@/components/asciicn/scenes/${scene.id}`,
          kind: "scene",
          label: SCENE_TITLES[scene.id],
          load: scene.load,
          registry: scene.id,
        } satisfies SceneSource,
      ]
    : []
);

const MEDIA_SOURCES: readonly MediaSource[] = [
  {
    defaults: { cell: 9, charset: "standard", colorMode: "truecolor" },
    group: "media",
    hint: "A photo, or drop your own",
    id: "image",
    importName: "AsciiImage",
    importPath: "@/components/asciicn/ascii-image",
    kind: "media",
    label: "Image",
    registry: "ascii-image",
  },
  {
    defaults: { cell: 9, charset: "standard", colorMode: "truecolor" },
    group: "media",
    hint: "A file or a URL",
    id: "video",
    importName: "AsciiVideo",
    importPath: "@/components/asciicn/ascii-video",
    kind: "media",
    label: "Video",
    registry: "ascii-video",
  },
  {
    defaults: { cell: 9, charset: "dense", colorMode: "mono", ink: "p1" },
    group: "media",
    hint: "Your camera, live",
    id: "webcam",
    importName: "AsciiVideo",
    importPath: "@/components/asciicn/ascii-video",
    kind: "media",
    label: "Webcam",
    registry: "ascii-video",
  },
  {
    defaults: { cell: 8, charset: "blocks", colorMode: "mono" },
    group: "media",
    hint: "Type a banner",
    id: "text",
    importName: "AsciiText",
    importPath: "@/components/asciicn/ascii-text",
    kind: "media",
    label: "Text",
    registry: "ascii-text",
  },
];

export const SOURCES: readonly StudioSource[] = [
  ...FIELD_SOURCES,
  ...SCENE_SOURCES,
  ...MEDIA_SOURCES,
];

// Silk is always there: it ships with the first registry build.
const FALLBACK: StudioSource = {
  defaults: { cell: 12, charset: "blocks", colorMode: "native" },
  group: "backgrounds",
  hint: "Folds of cloth catching the light",
  id: "silk",
  importName: "Silk",
  importPath: "@/components/asciicn/silk",
  kind: "field",
  label: "Silk",
  load: async () => {
    const { Silk } = await import("@/components/asciicn/silk");
    return Silk;
  },
  registry: "silk",
  seeded: false,
};

const BY_ID = new Map<SourceId, StudioSource>(
  SOURCES.map((source) => [source.id, source])
);

/** The source for an id. Every id in `SOURCE_IDS` has one. */
export const getSource = (id: SourceId): StudioSource =>
  BY_ID.get(id) ?? FALLBACK;

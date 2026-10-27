import type { ComponentType } from "react";

import type { CharsetName } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { SCENES } from "@/lib/scenes";

/**
 * What the home page and /scenes can put on a stage: the 12 scenes, plus a
 * few background shaders from the catalogue. Site-only.
 */

/** `gpu` scenes draw through WebGL2 and count against the context budget. */
export type Renderer = "gpu" | "canvas";

export interface StageSource {
  /** Registry name, docs slug and `?source=` value. */
  readonly id: string;
  readonly kind: "scene" | "shader";
  readonly title: string;
  readonly description: string;
  readonly renderer: Renderer;
  /** The charset the component draws with when none is passed. */
  readonly charset: CharsetName;
  /** Exported component name, for the JSX snippet. */
  readonly exportName: string;
  /** Docs page. */
  readonly href: string;
  readonly load: () => Promise<ComponentType<AsciiSceneProps>>;
}

/**
 * Renderer and default charset per scene. `lib/scenes.ts` doesn't carry
 * them yet, so they live here; keep them in step with the scene files.
 */
const SCENE_META = {
  "abyssal-jellyfish-scene": { charset: "standard", renderer: "gpu" },
  "black-hole-scene": { charset: "braille", renderer: "gpu" },
  "campfire-woods-scene": { charset: "standard", renderer: "gpu" },
  "coastal-lighthouse-scene": { charset: "standard", renderer: "gpu" },
  "cyberpunk-rain-scene": { charset: "katakana", renderer: "gpu" },
  "fluid-smoke-scene": { charset: "braille", renderer: "canvas" },
  "matrix-cathedral-scene": { charset: "katakana", renderer: "canvas" },
  "sacred-torus-scene": { charset: "standard", renderer: "canvas" },
  "synthwave-horizon-scene": { charset: "braille", renderer: "gpu" },
  "tempest-storm-scene": { charset: "standard", renderer: "gpu" },
  "terminal-deck-scene": { charset: "braille", renderer: "canvas" },
  "warp-tunnel-scene": { charset: "standard", renderer: "gpu" },
} as const satisfies Record<
  string,
  { charset: CharsetName; renderer: Renderer }
>;

type SceneId = keyof typeof SCENE_META;

const isSceneId = (id: string): id is SceneId => Object.hasOwn(SCENE_META, id);

const pascal = (id: string) =>
  id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export const SCENE_SOURCES: readonly StageSource[] = SCENES.map((scene) => {
  const meta = isSceneId(scene.id)
    ? SCENE_META[scene.id]
    : ({ charset: "standard", renderer: "gpu" } as const);
  return {
    charset: meta.charset,
    description: scene.description,
    exportName: pascal(scene.id),
    href: `/docs/scenes/${scene.id}`,
    id: scene.id,
    kind: "scene",
    load: scene.load,
    renderer: meta.renderer,
    title: scene.title,
  };
});

// The background components take the shader's props. Spreading the scene
// props through keeps the look switches working as the shader learns them.
export const SHADER_SOURCES: readonly StageSource[] = [
  {
    charset: "blocks",
    description: "Interfering sine waves bent by slow noise.",
    exportName: "Plasma",
    href: "/docs/backgrounds/plasma",
    id: "plasma",
    kind: "shader",
    load: async () => {
      const { Plasma } = await import("@/components/asciicn/plasma");
      return (props: AsciiSceneProps) => <Plasma {...props} />;
    },
    renderer: "gpu",
    title: "Plasma",
  },
  {
    charset: "braille",
    description: "Curtains of light folding across the sky.",
    exportName: "Aurora",
    href: "/docs/backgrounds/aurora",
    id: "aurora",
    kind: "shader",
    load: async () => {
      const { Aurora } = await import("@/components/asciicn/aurora");
      return (props: AsciiSceneProps) => <Aurora {...props} />;
    },
    renderer: "gpu",
    title: "Aurora",
  },
  {
    charset: "standard",
    description: "Rings rushing toward the viewer down an endless tube.",
    exportName: "Tunnel",
    href: "/docs/backgrounds/tunnel",
    id: "tunnel",
    kind: "shader",
    load: async () => {
      const { Tunnel } = await import("@/components/asciicn/tunnel");
      return (props: AsciiSceneProps) => <Tunnel {...props} />;
    },
    renderer: "gpu",
    title: "Tunnel",
  },
  {
    charset: "quadrants",
    description: "Soft blobs that merge and split as they drift.",
    exportName: "Metaballs",
    href: "/docs/backgrounds/metaballs",
    id: "metaballs",
    kind: "shader",
    load: async () => {
      const { Metaballs } = await import("@/components/asciicn/metaballs");
      return (props: AsciiSceneProps) => <Metaballs {...props} />;
    },
    renderer: "gpu",
    title: "Metaballs",
  },
  {
    charset: "standard",
    description: "Height lines over a slowly moving noise terrain.",
    exportName: "Contours",
    href: "/docs/backgrounds/contours",
    id: "contours",
    kind: "shader",
    load: async () => {
      const { Contours } = await import("@/components/asciicn/contours");
      return (props: AsciiSceneProps) => <Contours {...props} />;
    },
    renderer: "gpu",
    title: "Contours",
  },
];

export const STAGE_SOURCES: readonly StageSource[] = [
  ...SCENE_SOURCES,
  ...SHADER_SOURCES,
];

export const findSource = (
  id: string | null | undefined,
  sources: readonly StageSource[] = STAGE_SOURCES
): StageSource | undefined => sources.find((source) => source.id === id);

// Each source loads once per page; switching back is instant.
const loaded = new Map<string, Promise<ComponentType<AsciiSceneProps>>>();

export const loadSource = (
  source: StageSource
): Promise<ComponentType<AsciiSceneProps>> => {
  const cached = loaded.get(source.id);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    try {
      return await source.load();
    } catch (error) {
      // A failed chunk shouldn't stay cached forever.
      loaded.delete(source.id);
      throw error;
    }
  })();
  loaded.set(source.id, pending);
  return pending;
};

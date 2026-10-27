import type { ComponentType } from "react";

import type { CharsetName } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { CITIES, cityDocsUrl } from "@/lib/cities";
import type { CityRenderer } from "@/lib/cities";

/**
 * What /backgrounds can put on a stage: the city backgrounds, plus a few
 * seeded fields from the catalogue. Site-only.
 */

/** `gpu` sources draw through WebGL2 and count against the context budget. */
export type Renderer = CityRenderer;

export interface StageSource {
  /** Registry name, docs slug and `?source=` value. */
  readonly id: string;
  readonly kind: "city" | "shader";
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

const pascal = (id: string) =>
  id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export const CITY_SOURCES: readonly StageSource[] = CITIES.map((city) => ({
  charset: city.charset,
  description: city.description,
  exportName: pascal(city.id),
  href: cityDocsUrl(city.id),
  id: city.id,
  kind: "city",
  load: city.load,
  renderer: city.renderer,
  title: city.title,
}));

// The background components take the shader's props. Spreading the city
// props through keeps the look switches working as the shader learns them.
export const SHADER_SOURCES: readonly StageSource[] = [
  {
    charset: "dense",
    description: "Gas clouds lit from within, reshaped by a seed.",
    exportName: "Nebula",
    href: "/docs/fields/nebula",
    id: "nebula",
    kind: "shader",
    load: async () => {
      const { Nebula } = await import("@/components/asciicn/nebula");
      return Nebula;
    },
    renderer: "gpu",
    title: "Nebula",
  },
  {
    charset: "dense",
    description: "Refracting ribbons of light, reshaped by a seed.",
    exportName: "Prism",
    href: "/docs/fields/prism",
    id: "prism",
    kind: "shader",
    load: async () => {
      const { Prism } = await import("@/components/asciicn/prism");
      return Prism;
    },
    renderer: "gpu",
    title: "Prism",
  },
  {
    charset: "braille",
    description: "Charged filaments that branch and fade, reshaped by a seed.",
    exportName: "Ionize",
    href: "/docs/fields/ionize",
    id: "ionize",
    kind: "shader",
    load: async () => {
      const { Ionize } = await import("@/components/asciicn/ionize");
      return Ionize;
    },
    renderer: "gpu",
    title: "Ionize",
  },
  {
    charset: "standard",
    description: "Gusts and squalls blown across the box, reshaped by a seed.",
    exportName: "Squall",
    href: "/docs/fields/squall",
    id: "squall",
    kind: "shader",
    load: async () => {
      const { Squall } = await import("@/components/asciicn/squall");
      return Squall;
    },
    renderer: "gpu",
    title: "Squall",
  },
  {
    charset: "blocks",
    description: "A soft sheen rolling over cloth, reshaped by a seed.",
    exportName: "Satin",
    href: "/docs/fields/satin",
    id: "satin",
    kind: "shader",
    load: async () => {
      const { Satin } = await import("@/components/asciicn/satin");
      return Satin;
    },
    renderer: "gpu",
    title: "Satin",
  },
];

export const STAGE_SOURCES: readonly StageSource[] = [
  ...CITY_SOURCES,
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

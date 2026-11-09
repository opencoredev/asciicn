import type { ComponentType } from "react";

import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { BACKGROUNDS } from "@/lib/backgrounds";
import type { BackgroundGroup } from "@/lib/backgrounds";

/**
 * The city and landscape backgrounds as the landing and /backgrounds show
 * them. Site-only: the registry ships the components, not this list.
 */

export interface StageSource {
  /** Registry name, docs slug, `?city=` value and Studio `?source=` value. */
  readonly id: string;
  readonly group: BackgroundGroup;
  readonly title: string;
  readonly description: string;
  /** Docs page. */
  readonly href: string;
  readonly load: () => Promise<ComponentType<AsciiSceneProps>>;
}

/** Every background, cities and landscapes, in gallery order. */
export const CITY_SOURCES: readonly StageSource[] = BACKGROUNDS.map(
  (entry) => ({
    description: entry.description,
    group: entry.group,
    href: entry.href,
    id: entry.id,
    load: entry.load,
    title: entry.title,
  })
);

export const findSource = (
  id: string | null | undefined,
  sources: readonly StageSource[] = CITY_SOURCES
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

import { CITIES, cityDocsUrl } from "@/lib/cities";
import type { CityEntry } from "@/lib/cities";
import { LANDSCAPES, landscapeDocsUrl } from "@/lib/landscapes";

/**
 * Every background the site shows off, cities and landscapes together.
 * Site-only: the registry ships the components, not this list.
 */

export type BackgroundGroup = "cities" | "landscapes";

export interface BackgroundEntry extends CityEntry {
  readonly group: BackgroundGroup;
  /** Docs page. */
  readonly href: string;
}

const tagged: readonly BackgroundEntry[] = [
  ...CITIES.map((city) => ({
    ...city,
    group: "cities" as const,
    href: cityDocsUrl(city.id),
  })),
  ...LANDSCAPES.map((landscape) => ({
    ...landscape,
    group: "landscapes" as const,
    href: landscapeDocsUrl(landscape.id),
  })),
];

// The painted scenes lead, alternating city and landscape so the gallery
// opens on variety. Anything not named keeps its list order after them.
const LEAD = [
  "san-francisco",
  "balloon-valley",
  "tokyo",
  "glacier-lagoon",
  "paris",
  "canyon-river",
  "new-york",
  "lighthouse",
  "rice-terraces",
  "redwood-light",
] as const;

const rank = (id: string) => {
  const index = LEAD.indexOf(id as (typeof LEAD)[number]);
  return index === -1 ? LEAD.length : index;
};

export const BACKGROUNDS: readonly BackgroundEntry[] = tagged.toSorted(
  (a, b) => rank(a.id) - rank(b.id)
);

/**
 * What the landing hero rotates through, in order. It opens on San
 * Francisco, whose orange bridge sits with the amber accent.
 */
const HERO_IDS = [
  "san-francisco",
  "balloon-valley",
  "canyon-river",
  "tokyo",
  "lighthouse",
  "paris",
  "glacier-lagoon",
  "new-york",
] as const;

export const HERO_BACKGROUNDS: readonly BackgroundEntry[] = HERO_IDS.flatMap(
  (id) => BACKGROUNDS.filter((entry) => entry.id === id)
);

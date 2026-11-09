/**
 * Every source the Studio can draw, by id, with what kind of renderer it
 * needs. Pure and server-safe so the route can validate `?source=` without
 * pulling in any component. The loaders live in `sources.ts`.
 */

/** Seeded GPU backgrounds and the two 3D objects. */
export const FIELD_SOURCE_IDS = [
  "nebula",
  "prism",
  "ionize",
  "squall",
  "satin",
  "torus-3d",
  "globe-3d",
] as const;

/** The city and landscape backgrounds, matching `lib/cities.ts` and `lib/landscapes.ts`. */
export const SCENE_SOURCE_IDS = [
  "miami",
  "tokyo",
  "new-york",
  "paris",
  "london",
  "dubai",
  "san-francisco",
  "hong-kong",
  "rio",
  "sydney",
  "balloon-valley",
  "glacier-lagoon",
  "canyon-river",
  "lighthouse",
  "rice-terraces",
  "redwood-light",
] as const;

/** Sources sampled on the CPU from pixels. */
export const MEDIA_SOURCE_IDS = ["image", "video", "webcam", "text"] as const;

export const SOURCE_IDS = [
  ...FIELD_SOURCE_IDS,
  ...SCENE_SOURCE_IDS,
  ...MEDIA_SOURCE_IDS,
] as const;

export type FieldSourceId = (typeof FIELD_SOURCE_IDS)[number];
export type SceneSourceId = (typeof SCENE_SOURCE_IDS)[number];
export type MediaSourceId = (typeof MEDIA_SOURCE_IDS)[number];
export type SourceId = (typeof SOURCE_IDS)[number];

export const isMediaSource = (id: SourceId): id is MediaSourceId =>
  MEDIA_SOURCE_IDS.some((media) => media === id);

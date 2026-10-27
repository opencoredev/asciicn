/**
 * Seeded fields: any string becomes a unique, well-exposed GPU field with
 * its own OKLCH palette and motion. Placeholder until the seeded-field
 * engine lands; the backgrounds that use it import from here.
 */

/** Parameters derived from a seed. */
export type SeedParams = Readonly<Record<string, number>>;

/** Deterministic parameters for `seed`. */
export const seedParams = (seed: string): SeedParams => {
  let hash = 7;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return { hue: (hash % 360) / 360 };
};

import type { CityEntry } from "@/lib/cities";

/**
 * The painted landscape backgrounds, in the shape of `CITIES` so the
 * gallery, the hero and the Studio treat both alike. Site-only: the
 * registry ships the components, not this list.
 */
export const LANDSCAPES: readonly CityEntry[] = [
  {
    charset: "dots",
    description:
      "Early morning over a river valley in halftone dots on cream: cool blue hills fading into haze, pale gold mist, a river catching the low sun and hot-air balloons at different depths.",
    id: "balloon-valley",
    load: async () => {
      const { BalloonValley } =
        await import("@/components/asciicn/balloon-valley");
      return BalloonValley;
    },
    renderer: "gpu",
    title: "Balloon valley",
  },
  {
    charset: "dots",
    description:
      "Icebergs glowing blue-white on a glassy lagoon below a glacier and dark peaks, under a midnight sun sitting gold and rose on the horizon.",
    id: "glacier-lagoon",
    load: async () => {
      const { GlacierLagoon } =
        await import("@/components/asciicn/glacier-lagoon");
      return GlacierLagoon;
    },
    renderer: "gpu",
    title: "Glacier lagoon",
  },
  {
    charset: "dots",
    description:
      "A desert canyon in late golden hour from a high rim: sunlit terracotta walls with blue shadows step back to glowing buttes while a river winds below, mirroring the blue sky.",
    id: "canyon-river",
    load: async () => {
      const { CanyonRiver } = await import("@/components/asciicn/canyon-river");
      return CanyonRiver;
    },
    renderer: "gpu",
    title: "Canyon river",
  },
  {
    charset: "dots",
    description:
      "A lighthouse on a rocky headland at blue hour, its lamp glowing amber over a calm sea.",
    id: "lighthouse",
    load: async () => {
      const { Lighthouse } = await import("@/components/asciicn/lighthouse");
      return Lighthouse;
    },
    renderer: "gpu",
    title: "Lighthouse",
  },
  {
    charset: "dots",
    description:
      "Flooded rice terraces at a fresh dawn: silver-blue fields between dark earthen banks with lit grassy tops, mist in the valley and far ridges fading into haze.",
    id: "rice-terraces",
    load: async () => {
      const { RiceTerraces } =
        await import("@/components/asciicn/rice-terraces");
      return RiceTerraces;
    },
    renderer: "gpu",
    title: "Rice terraces",
  },
  {
    charset: "dots",
    description:
      "A redwood forest in early morning: giant trunks fading into blue-green haze, golden light shafts slanting onto a fern floor, and slow motes drifting in the light.",
    id: "redwood-light",
    load: async () => {
      const { RedwoodLight } =
        await import("@/components/asciicn/redwood-light");
      return RedwoodLight;
    },
    renderer: "gpu",
    title: "Redwood light",
  },
];

/** A landscape's docs page. */
export const landscapeDocsUrl = (id: string) => `/docs/landscapes/${id}`;

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
      "Sunrise over a river valley: layered hills fading into haze, mist on the valley floor, a river catching the low sun and hot-air balloons hanging at different depths.",
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
      "A desert canyon at dusk from a high rim: terraced walls step back to glowing mesas in violet haze while a river winds below, mirroring the sunset.",
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
      "Flooded rice terraces at dawn: each curved pool mirrors the pink and gold sky, mist fills the valley below and distant ridges fade into blue haze.",
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

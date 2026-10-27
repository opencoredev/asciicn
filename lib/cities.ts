import type { ComponentType } from "react";

import type { CharsetName } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** `gpu` backgrounds draw through WebGL2 and count against the context budget. */
export type CityRenderer = "gpu" | "canvas";

/** One city background in the gallery. Site-only: the registry ships the components, not this list. */
export interface CityEntry {
  /** Registry name and docs slug, such as `"tokyo"`. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The charset the component draws with when none is passed; keep it in step with the component. */
  readonly charset: CharsetName;
  readonly renderer: CityRenderer;
  /** Loads the component, so pages only pay for the city on screen. */
  readonly load: () => Promise<ComponentType<AsciiSceneProps>>;
}

export const CITIES: readonly CityEntry[] = [
  {
    charset: "standard",
    description:
      "Ocean Drive at dusk: art deco hotels with flickering neon fins, swaying palms, cars on the drive and a slow surf under a low sun.",
    id: "miami",
    load: async () => {
      const { Miami } = await import("@/components/asciicn/miami");
      return Miami;
    },
    renderer: "gpu",
    title: "Miami",
  },
  {
    charset: "braille",
    description:
      "Tokyo on a clear night: Tokyo Tower lit among towers of windows, vertical neon signs, a train on a curving elevated line and Mount Fuji on the horizon.",
    id: "tokyo",
    load: async () => {
      const { Tokyo } = await import("@/components/asciicn/tokyo");
      return Tokyo;
    },
    renderer: "gpu",
    title: "Tokyo",
  },
  {
    charset: "standard",
    description:
      "Manhattan at night from across the East River, with the Empire State and Chrysler buildings, a skyline of lit windows, the Brooklyn Bridge and a ferry.",
    id: "new-york",
    load: async () => {
      const { NewYork } = await import("@/components/asciicn/new-york");
      return NewYork;
    },
    renderer: "gpu",
    title: "New York",
  },
  {
    charset: "standard",
    description:
      "The Eiffel Tower glowing gold at blue hour over the Seine, with its sparkle, its beacon, a bateau-mouche and zinc rooftops.",
    id: "paris",
    load: async () => {
      const { Paris } = await import("@/components/asciicn/paris");
      return Paris;
    },
    renderer: "gpu",
    title: "Paris",
  },
  {
    charset: "standard",
    description:
      "Big Ben, the Houses of Parliament and Tower Bridge in evening fog over the Thames, with amber lamps and a red bus crossing.",
    id: "london",
    load: async () => {
      const { London } = await import("@/components/asciicn/london");
      return London;
    },
    renderer: "gpu",
    title: "London",
  },
  {
    charset: "standard",
    description:
      "Dubai at golden hour: the Burj Khalifa catching the last sun above a cluster of glass towers, the sail of the Burj Al Arab on the shore, and dunes with sand blowing off their crests.",
    id: "dubai",
    load: async () => {
      const { Dubai } = await import("@/components/asciicn/dubai");
      return Dubai;
    },
    renderer: "gpu",
    title: "Dubai",
  },
  {
    charset: "standard",
    description:
      "The Golden Gate Bridge on a foggy morning: orange towers, fog rolling through the strait and under the deck, the city and the Transamerica Pyramid behind, and sailboats on the bay.",
    id: "san-francisco",
    load: async () => {
      const { SanFrancisco } =
        await import("@/components/asciicn/san-francisco");
      return SanFrancisco;
    },
    renderer: "gpu",
    title: "San Francisco",
  },
  {
    charset: "braille",
    description:
      "Victoria Harbour at night from Kowloon: towers up the slopes of Victoria Peak, the Bank of China Tower and IFC, a rooftop light show, and a junk and a Star Ferry on the mirrored water.",
    id: "hong-kong",
    load: async () => {
      const { HongKong } = await import("@/components/asciicn/hong-kong");
      return HongKong;
    },
    renderer: "gpu",
    title: "Hong Kong",
  },
  {
    charset: "standard",
    description:
      "Sugarloaf and Corcovado in the late afternoon over Copacabana, with cable cars, breaking surf, the wave-mosaic promenade and frigatebirds.",
    id: "rio",
    load: async () => {
      const { Rio } = await import("@/components/asciicn/rio");
      return Rio;
    },
    renderer: "gpu",
    title: "Rio de Janeiro",
  },
  {
    charset: "braille",
    description:
      "Sydney Harbour at night: the Opera House lit white, the Harbour Bridge behind it, fireworks bursting over the arch and the whole scene mirrored in the water.",
    id: "sydney",
    load: async () => {
      const { Sydney } = await import("@/components/asciicn/sydney");
      return Sydney;
    },
    renderer: "gpu",
    title: "Sydney",
  },
];

/** The docs URL for a city background. */
export const cityDocsUrl = (id: string) => `/docs/backgrounds/${id}`;

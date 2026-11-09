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
    charset: "quadrants",
    description:
      "Ocean Drive at nightfall: art deco hotels with stepped parapets and neon trim, the glass towers of Brickell behind, still palms and neon reflections in the bay.",
    id: "miami",
    load: async () => {
      const { Miami } = await import("@/components/asciicn/miami");
      return Miami;
    },
    renderer: "gpu",
    title: "Miami",
  },
  {
    charset: "quadrants",
    description:
      "Tokyo at night: Tokyo Tower in orange and white with both decks lit, a dense skyline of lit windows, a train on an elevated line and Mount Fuji in the distance.",
    id: "tokyo",
    load: async () => {
      const { Tokyo } = await import("@/components/asciicn/tokyo");
      return Tokyo;
    },
    renderer: "gpu",
    title: "Tokyo",
  },
  {
    charset: "quadrants",
    description:
      "Manhattan at night from across the river: One World Trade Center, the Empire State and Chrysler buildings, a skyline of lit windows and a slow ferry on calm water.",
    id: "new-york",
    load: async () => {
      const { NewYork } = await import("@/components/asciicn/new-york");
      return NewYork;
    },
    renderer: "gpu",
    title: "New York",
  },
  {
    charset: "dots",
    description:
      "Paris at blue hour in dots: the Eiffel Tower lit gold in a soft halo, Haussmann rooftops in blue shadow, the dome of Les Invalides in the last light, and the Seine holding the tower's long golden reflection.",
    id: "paris",
    load: async () => {
      const { Paris } = await import("@/components/asciicn/paris");
      return Paris;
    },
    renderer: "gpu",
    title: "Paris",
  },
  {
    charset: "quadrants",
    description:
      "Westminster at night across the Thames: the Elizabeth Tower with its lit clock, the Palace of Westminster, Tower Bridge and the Shard, with amber lamps on the embankment.",
    id: "london",
    load: async () => {
      const { London } = await import("@/components/asciicn/london");
      return London;
    },
    renderer: "gpu",
    title: "London",
  },
  {
    charset: "quadrants",
    description:
      "Dubai at night from the water: the Burj Khalifa stepping up to its spire and beacon, the Emirates Towers, the Marina and the sail of the Burj Al Arab, with lit windows and calm reflections.",
    id: "dubai",
    load: async () => {
      const { Dubai } = await import("@/components/asciicn/dubai");
      return Dubai;
    },
    renderer: "gpu",
    title: "Dubai",
  },
  {
    charset: "quadrants",
    description:
      "The Golden Gate Bridge at night: orange towers with stepped portals, the main cable dipping to the deck, the Marin Headlands, a low fog bank and the downtown skyline with the Transamerica Pyramid and Salesforce Tower.",
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
    charset: "quadrants",
    description:
      "Victoria Harbour at night from Kowloon: a wall of lit towers below the ridge of Victoria Peak, with Central Plaza, the Bank of China Tower and Two IFC, calm reflections and the Star Ferry.",
    id: "hong-kong",
    load: async () => {
      const { HongKong } = await import("@/components/asciicn/hong-kong");
      return HongKong;
    },
    renderer: "gpu",
    title: "Hong Kong",
  },
  {
    charset: "quadrants",
    description:
      "Rio de Janeiro at night from the sea: Sugarloaf with its cable car, Christ the Redeemer lit white on Corcovado, and the lamps of Copacabana on a calm bay.",
    id: "rio",
    load: async () => {
      const { Rio } = await import("@/components/asciicn/rio");
      return Rio;
    },
    renderer: "gpu",
    title: "Rio de Janeiro",
  },
  {
    charset: "quadrants",
    description:
      "Sydney Harbour at night: the Opera House lit cream-white on its podium, the Harbour Bridge behind it, Circular Quay's towers and one ferry on calm water.",
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

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
    charset: "dots",
    description:
      "Tokyo at dusk in coloured dots: Tokyo Tower glowing orange and white with both decks lit, a deep city fading into blue haze and a snow-capped Mount Fuji under an orange to indigo sky.",
    id: "tokyo",
    load: async () => {
      const { Tokyo } = await import("@/components/asciicn/tokyo");
      return Tokyo;
    },
    renderer: "gpu",
    title: "Tokyo",
  },
  {
    charset: "dots",
    description:
      "Manhattan at dusk across the East River: the Empire State Building's lit spire, the Chrysler crown and One World Trade Center against an amber-to-blue sky, with soft window light, broken reflections and a slow ferry.",
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
    charset: "dots",
    description:
      "Westminster at dusk in dots: the Elizabeth Tower's clock face glowing warm, the palace roofline lit gold, Westminster Bridge and its lamps, and the Thames holding long broken reflections under a misty gold to slate sky.",
    id: "london",
    load: async () => {
      const { London } = await import("@/components/asciicn/london");
      return London;
    },
    renderer: "gpu",
    title: "London",
  },
  {
    charset: "dots",
    description:
      "Dubai at dusk from the desert in dots: the Burj Khalifa rising far above a cluster of towers in blue haze, its stepped spire gold in the last light, over rose and amber dunes under a gold-to-blue sky.",
    id: "dubai",
    load: async () => {
      const { Dubai } = await import("@/components/asciicn/dubai");
      return Dubai;
    },
    renderer: "gpu",
    title: "Dubai",
  },
  {
    charset: "dots",
    description:
      "The Golden Gate Bridge at blue hour in halftone dots: Art Deco towers in International Orange catching the last light, fog rolling under the deck and over the Marin Headlands, city lights on the far shore and the bay mirroring the afterglow.",
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
    charset: "dots",
    description:
      "Victoria Harbour at blue hour in coloured dots: lit towers climbing to the misty ridge of Victoria Peak, the Bank of China Tower and Two IFC, long reflections and a red-sailed junk under a magenta to deep blue sky.",
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

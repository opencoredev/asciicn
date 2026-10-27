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
      "Ocean Drive at dusk: art deco hotels glowing in neon pastels, swaying palms and a slow surf under a pink sky.",
    id: "miami",
    load: async () => {
      const { Miami } = await import("@/components/asciicn/miami");
      return Miami;
    },
    renderer: "canvas",
    title: "Miami",
  },
  {
    charset: "standard",
    description:
      "Tokyo at night: Tokyo Tower over a skyline of lit towers, with neon signs flickering above busy streets.",
    id: "tokyo",
    load: async () => {
      const { Tokyo } = await import("@/components/asciicn/tokyo");
      return Tokyo;
    },
    renderer: "canvas",
    title: "Tokyo",
  },
  {
    charset: "standard",
    description:
      "Manhattan at night: the Empire State and Chrysler buildings, thousands of lit windows and the Brooklyn Bridge over the river.",
    id: "new-york",
    load: async () => {
      const { NewYork } = await import("@/components/asciicn/new-york");
      return NewYork;
    },
    renderer: "canvas",
    title: "New York",
  },
  {
    charset: "standard",
    description:
      "The Eiffel Tower sparkling over the Seine at twilight, with zinc rooftops and drifting clouds.",
    id: "paris",
    load: async () => {
      const { Paris } = await import("@/components/asciicn/paris");
      return Paris;
    },
    renderer: "canvas",
    title: "Paris",
  },
  {
    charset: "standard",
    description:
      "Big Ben and Tower Bridge in rolling fog over the Thames, with a red bus crossing.",
    id: "london",
    load: async () => {
      const { London } = await import("@/components/asciicn/london");
      return London;
    },
    renderer: "canvas",
    title: "London",
  },
  {
    charset: "standard",
    description:
      "The Burj Khalifa rising over a glittering skyline, with desert dunes and heat shimmer behind it.",
    id: "dubai",
    load: async () => {
      const { Dubai } = await import("@/components/asciicn/dubai");
      return Dubai;
    },
    renderer: "canvas",
    title: "Dubai",
  },
  {
    charset: "standard",
    description:
      "The Golden Gate Bridge as fog pours through the strait, with the city on its hills behind.",
    id: "san-francisco",
    load: async () => {
      const { SanFrancisco } =
        await import("@/components/asciicn/san-francisco");
      return SanFrancisco;
    },
    renderer: "canvas",
    title: "San Francisco",
  },
  {
    charset: "standard",
    description:
      "Victoria Harbour at night: dense towers mirrored in the water, with a junk boat drifting past.",
    id: "hong-kong",
    load: async () => {
      const { HongKong } = await import("@/components/asciicn/hong-kong");
      return HongKong;
    },
    renderer: "canvas",
    title: "Hong Kong",
  },
  {
    charset: "standard",
    description:
      "Sugarloaf Mountain over the bay and the Copacabana shoreline, with the statue on Corcovado above.",
    id: "rio",
    load: async () => {
      const { Rio } = await import("@/components/asciicn/rio");
      return Rio;
    },
    renderer: "canvas",
    title: "Rio de Janeiro",
  },
  {
    charset: "standard",
    description:
      "The Opera House and Harbour Bridge, with fireworks bursting over the harbour.",
    id: "sydney",
    load: async () => {
      const { Sydney } = await import("@/components/asciicn/sydney");
      return Sydney;
    },
    renderer: "canvas",
    title: "Sydney",
  },
];

/** The docs URL for a city background. */
export const cityDocsUrl = (id: string) => `/docs/backgrounds/${id}`;

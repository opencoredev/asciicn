import type { ComponentType } from "react";

import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** One scene in the gallery. Site-only: the registry ships the components, not this list. */
export interface SceneEntry {
  /** Registry name and docs slug, such as `"black-hole-scene"`. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Loads the component, so pages only pay for the scene on screen. */
  readonly load: () => Promise<ComponentType<AsciiSceneProps>>;
}

export const SCENES: readonly SceneEntry[] = [
  {
    description:
      "A layered cyberpunk skyline in the rain: glowing katakana holograms, wet street reflections and diagonal rain streaks, with pointer parallax across the depth layers.",
    id: "cyberpunk-rain-scene",
    load: async () => {
      const { CyberpunkRainScene } =
        await import("@/components/asciicn/scenes/cyberpunk-rain-scene");
      return CyberpunkRainScene;
    },
    title: "Neon Rain Metropolis",
  },
  {
    description:
      "A black hole bending the starfield behind it: a lensed accretion disk, a Doppler-shifted photon ring and swirling infalling matter.",
    id: "black-hole-scene",
    load: async () => {
      const { BlackHoleScene } =
        await import("@/components/asciicn/scenes/black-hole-scene");
      return BlackHoleScene;
    },
    title: "Gargantua Accretion Disk",
  },
  {
    description:
      "Scrolling wireframe mountains under a segmented retro sun, with starlight and scanlines over a perspective grid.",
    id: "synthwave-horizon-scene",
    load: async () => {
      const { SynthwaveHorizonScene } =
        await import("@/components/asciicn/scenes/synthwave-horizon-scene");
      return SynthwaveHorizonScene;
    },
    title: "Outrun Wireframe Horizon",
  },
  {
    description:
      "A lighthouse beam sweeping through fog over a breaking procedural sea and dark cliffs.",
    id: "coastal-lighthouse-scene",
    load: async () => {
      const { CoastalLighthouseScene } =
        await import("@/components/asciicn/scenes/coastal-lighthouse-scene");
      return CoastalLighthouseScene;
    },
    title: "Midnight Lighthouse & Storm Swell",
  },
  {
    description:
      "A live multi-pane terminal console: a rotating wireframe satellite, a scrolling hex dump, a waveform scope and system diagnostics.",
    id: "terminal-deck-scene",
    load: async () => {
      const { TerminalDeckScene } =
        await import("@/components/asciicn/scenes/terminal-deck-scene");
      return TerminalDeckScene;
    },
    title: "Retro CRT Cyberdeck OS",
  },
  {
    description:
      "A z-buffered 3D p-q torus knot and morphing polyhedra, shaded with directional edge glyphs.",
    id: "sacred-torus-scene",
    load: async () => {
      const { SacredTorusScene } =
        await import("@/components/asciicn/scenes/sacred-torus-scene");
      return SacredTorusScene;
    },
    title: "Sacred Geometry Torus Knot",
  },
  {
    description:
      "Perspective columns built from falling half-width katakana and hex streams, fading into depth fog.",
    id: "matrix-cathedral-scene",
    load: async () => {
      const { MatrixCathedralScene } =
        await import("@/components/asciicn/scenes/matrix-cathedral-scene");
      return MatrixCathedralScene;
    },
    title: "Digital Rain Vault",
  },
  {
    description:
      "A campfire's rising flame and drifting sparks among pine silhouettes, with softly pulsing fireflies.",
    id: "campfire-woods-scene",
    load: async () => {
      const { CampfireWoodsScene } =
        await import("@/components/asciicn/scenes/campfire-woods-scene");
      return CampfireWoodsScene;
    },
    title: "Ember Woods & Fireflies",
  },
  {
    description:
      "A high-speed wormhole of radially streaking glyphs, with a vanishing point you steer with the pointer.",
    id: "warp-tunnel-scene",
    load: async () => {
      const { WarpTunnelScene } =
        await import("@/components/asciicn/scenes/warp-tunnel-scene");
      return WarpTunnelScene;
    },
    title: "Relativistic Starfield Tunnel",
  },
  {
    description:
      "Jellyfish drifting with sine-driven tentacles, rising bubbles and caustic light rays in the deep.",
    id: "abyssal-jellyfish-scene",
    load: async () => {
      const { AbyssalJellyfishScene } =
        await import("@/components/asciicn/scenes/abyssal-jellyfish-scene");
      return AbyssalJellyfishScene;
    },
    title: "Bioluminescent Abyss Aquarium",
  },
  {
    description:
      "Volumetric storm clouds split by branching fractal lightning, with screen-flash bloom and wind-driven rain.",
    id: "tempest-storm-scene",
    load: async () => {
      const { TempestStormScene } =
        await import("@/components/asciicn/scenes/tempest-storm-scene");
      return TempestStormScene;
    },
    title: "Procedural Lightning & Cumulonimbus",
  },
  {
    description:
      "A smoke and ink plume driven by curl noise that swirls around the pointer, drawn in Braille or dense ramps.",
    id: "fluid-smoke-scene",
    load: async () => {
      const { FluidSmokeScene } =
        await import("@/components/asciicn/scenes/fluid-smoke-scene");
      return FluidSmokeScene;
    },
    title: "Interactive Curl-Noise Plume",
  },
];

/** The docs URL for a scene. */
export const sceneDocsUrl = (id: string) => `/docs/scenes/${id}`;

import type { ComponentType } from "react";

import type { CharsetName } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** `gpu` scenes draw through WebGL2 and count against the context budget. */
export type SceneRenderer = "gpu" | "canvas";

/** One scene in the gallery. Site-only: the registry ships the components, not this list. */
export interface SceneEntry {
  /** Registry name and docs slug, such as `"black-hole-scene"`. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The charset the component draws with when none is passed; keep it in step with the scene file. */
  readonly charset: CharsetName;
  readonly renderer: SceneRenderer;
  /** Loads the component, so pages only pay for the scene on screen. */
  readonly load: () => Promise<ComponentType<AsciiSceneProps>>;
}

export const SCENES: readonly SceneEntry[] = [
  {
    charset: "braille",
    description:
      "A layered cyberpunk skyline in the rain: glowing katakana holograms, wet street reflections and diagonal rain streaks, with pointer parallax across the depth layers.",
    id: "cyberpunk-rain-scene",
    load: async () => {
      const { CyberpunkRainScene } =
        await import("@/components/asciicn/scenes/cyberpunk-rain-scene");
      return CyberpunkRainScene;
    },
    renderer: "gpu",
    title: "Neon Rain Metropolis",
  },
  {
    charset: "braille",
    description:
      "A black hole bending the starfield behind it: a lensed accretion disk, a Doppler-shifted photon ring and swirling infalling matter.",
    id: "black-hole-scene",
    load: async () => {
      const { BlackHoleScene } =
        await import("@/components/asciicn/scenes/black-hole-scene");
      return BlackHoleScene;
    },
    renderer: "gpu",
    title: "Gargantua Accretion Disk",
  },
  {
    charset: "braille",
    description:
      "Scrolling wireframe mountains under a segmented retro sun, with starlight and scanlines over a perspective grid.",
    id: "synthwave-horizon-scene",
    load: async () => {
      const { SynthwaveHorizonScene } =
        await import("@/components/asciicn/scenes/synthwave-horizon-scene");
      return SynthwaveHorizonScene;
    },
    renderer: "gpu",
    title: "Outrun Wireframe Horizon",
  },
  {
    charset: "braille",
    description:
      "A lighthouse beam sweeping through fog over a breaking procedural sea and dark cliffs.",
    id: "coastal-lighthouse-scene",
    load: async () => {
      const { CoastalLighthouseScene } =
        await import("@/components/asciicn/scenes/coastal-lighthouse-scene");
      return CoastalLighthouseScene;
    },
    renderer: "gpu",
    title: "Midnight Lighthouse & Storm Swell",
  },
  {
    charset: "braille",
    description:
      "A live multi-pane terminal console: a rotating wireframe satellite, a scrolling hex dump, a waveform scope and system diagnostics.",
    id: "terminal-deck-scene",
    load: async () => {
      const { TerminalDeckScene } =
        await import("@/components/asciicn/scenes/terminal-deck-scene");
      return TerminalDeckScene;
    },
    renderer: "canvas",
    title: "Retro CRT Cyberdeck OS",
  },
  {
    charset: "standard",
    description:
      "A z-buffered 3D p-q torus knot and morphing polyhedra, shaded with directional edge glyphs.",
    id: "sacred-torus-scene",
    load: async () => {
      const { SacredTorusScene } =
        await import("@/components/asciicn/scenes/sacred-torus-scene");
      return SacredTorusScene;
    },
    renderer: "canvas",
    title: "Sacred Geometry Torus Knot",
  },
  {
    charset: "katakana",
    description:
      "Perspective columns built from falling half-width katakana and hex streams, fading into depth fog.",
    id: "matrix-cathedral-scene",
    load: async () => {
      const { MatrixCathedralScene } =
        await import("@/components/asciicn/scenes/matrix-cathedral-scene");
      return MatrixCathedralScene;
    },
    renderer: "canvas",
    title: "Digital Rain Vault",
  },
  {
    charset: "standard",
    description:
      "A campfire's rising flame and drifting sparks among pine silhouettes, with softly pulsing fireflies.",
    id: "campfire-woods-scene",
    load: async () => {
      const { CampfireWoodsScene } =
        await import("@/components/asciicn/scenes/campfire-woods-scene");
      return CampfireWoodsScene;
    },
    renderer: "gpu",
    title: "Ember Woods & Fireflies",
  },
  {
    charset: "standard",
    description:
      "A high-speed wormhole of radially streaking glyphs, with a vanishing point you steer with the pointer.",
    id: "warp-tunnel-scene",
    load: async () => {
      const { WarpTunnelScene } =
        await import("@/components/asciicn/scenes/warp-tunnel-scene");
      return WarpTunnelScene;
    },
    renderer: "gpu",
    title: "Relativistic Starfield Tunnel",
  },
  {
    charset: "standard",
    description:
      "Jellyfish drifting with sine-driven tentacles, rising bubbles and caustic light rays in the deep.",
    id: "abyssal-jellyfish-scene",
    load: async () => {
      const { AbyssalJellyfishScene } =
        await import("@/components/asciicn/scenes/abyssal-jellyfish-scene");
      return AbyssalJellyfishScene;
    },
    renderer: "gpu",
    title: "Bioluminescent Abyss Aquarium",
  },
  {
    charset: "standard",
    description:
      "Volumetric storm clouds split by branching fractal lightning, with screen-flash bloom and wind-driven rain.",
    id: "tempest-storm-scene",
    load: async () => {
      const { TempestStormScene } =
        await import("@/components/asciicn/scenes/tempest-storm-scene");
      return TempestStormScene;
    },
    renderer: "gpu",
    title: "Procedural Lightning & Cumulonimbus",
  },
  {
    charset: "braille",
    description:
      "A smoke and ink plume driven by curl noise that swirls around the pointer, drawn in Braille or dense ramps.",
    id: "fluid-smoke-scene",
    load: async () => {
      const { FluidSmokeScene } =
        await import("@/components/asciicn/scenes/fluid-smoke-scene");
      return FluidSmokeScene;
    },
    renderer: "canvas",
    title: "Interactive Curl-Noise Plume",
  },
];

/** The docs URL for a scene. */
export const sceneDocsUrl = (id: string) => `/docs/scenes/${id}`;

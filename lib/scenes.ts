import type { ComponentType } from "react";

import type { CharsetName } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";

/** `gpu` scenes draw through WebGL2 and count against the context budget. */
export type SceneRenderer = "gpu" | "canvas";

/** One scene in the gallery. Site-only: the registry ships the components, not this list. */
export interface SceneEntry {
  /** Registry name and docs slug, such as `"orrery-scene"`. */
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
  {
    charset: "braille",
    description:
      "Coral, fingerprint and labyrinth patterns growing out of a reaction-diffusion field; the pointer seeds new growth.",
    id: "morphogenesis-scene",
    load: async () => {
      const { MorphogenesisScene } =
        await import("@/components/asciicn/scenes/morphogenesis-scene");
      return MorphogenesisScene;
    },
    renderer: "canvas",
    title: "Glyph Morphogenesis",
  },
  {
    charset: "braille",
    description:
      "Thousands of starlings flocking at dusk, folding into ribbons and spheres; the pointer is a hawk they scatter from.",
    id: "murmuration-scene",
    load: async () => {
      const { MurmurationScene } =
        await import("@/components/asciicn/scenes/murmuration-scene");
      return MurmurationScene;
    },
    renderer: "canvas",
    title: "Starling Murmuration",
  },
  {
    charset: "standard",
    description:
      "A cloth banner woven from real words, rippling and folding in the wind; push or grab it with the pointer.",
    id: "woven-banner-scene",
    load: async () => {
      const { WovenBannerScene } =
        await import("@/components/asciicn/scenes/woven-banner-scene");
      return WovenBannerScene;
    },
    renderer: "canvas",
    title: "Woven Banner",
  },
  {
    charset: "standard",
    description:
      "Circuit traces growing like vines out of chips, with electrons racing along them; the pointer powers new branches.",
    id: "circuit-bloom-scene",
    load: async () => {
      const { CircuitBloomScene } =
        await import("@/components/asciicn/scenes/circuit-bloom-scene");
      return CircuitBloomScene;
    },
    renderer: "canvas",
    title: "Silicon Bloom",
  },
  {
    charset: "standard",
    description:
      "A brass orrery of meshing gears driving planets on their arms; drag to spin the clockwork faster.",
    id: "orrery-scene",
    load: async () => {
      const { OrreryScene } =
        await import("@/components/asciicn/scenes/orrery-scene");
      return OrreryScene;
    },
    renderer: "canvas",
    title: "Clockwork Orrery",
  },
  {
    charset: "dense",
    description:
      "Grains of sand pouring through an hourglass that turns itself over; the pointer tilts the glass and the sand follows.",
    id: "hourglass-scene",
    load: async () => {
      const { HourglassScene } =
        await import("@/components/asciicn/scenes/hourglass-scene");
      return HourglassScene;
    },
    renderer: "canvas",
    title: "Falling Sand Hourglass",
  },
];

/** The docs URL for a scene. */
export const sceneDocsUrl = (id: string) => `/docs/scenes/${id}`;

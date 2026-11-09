"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { ComponentType } from "react";

import { useNearViewport } from "@/hooks/use-near-viewport";
import type { CatalogCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";

// Each demo is its own chunk, fetched when its tile nears the viewport.
const TorusKnotDemo = dynamic(() => import("@/examples/torus-knot-demo"), {
  ssr: false,
});
const AsciiGlobeDemo = dynamic(() => import("@/examples/ascii-globe-demo"), {
  ssr: false,
});
const AsciiPortraitDemo = dynamic(
  () => import("@/examples/ascii-portrait-demo"),
  {
    ssr: false,
  }
);
const TerminalWindowDemo = dynamic(
  () => import("@/examples/terminal-window-demo"),
  {
    ssr: false,
  }
);
const BlackHoleDemo = dynamic(() => import("@/examples/black-hole-demo"), {
  ssr: false,
});
const GlyphRainDemo = dynamic(() => import("@/examples/glyph-rain-demo"), {
  ssr: false,
});
const AsciiCountdownDemo = dynamic(
  () => import("@/examples/ascii-countdown-demo"),
  {
    ssr: false,
  }
);
const GlyphTrailDemo = dynamic(() => import("@/examples/glyph-trail-demo"), {
  ssr: false,
});
const DnaHelixDemo = dynamic(() => import("@/examples/dna-helix-demo"), {
  ssr: false,
});
const SynthwaveSunDemo = dynamic(
  () => import("@/examples/synthwave-sun-demo"),
  {
    ssr: false,
  }
);
const AsciiCanvasDemo = dynamic(() => import("@/examples/ascii-canvas-demo"), {
  ssr: false,
});

/**
 * The landing's example wall: the same demos the docs pages open with,
 * live and at their default settings, so what you see is what installs.
 * Each demo loads and mounts only as its tile nears the viewport, and WebGL
 * ones share the engine's context budget.
 */

interface Example {
  /** Docs URL of the component, which also finds its name and group. */
  url: string;
  Demo: ComponentType;
  /** `stretch` for full-bleed backgrounds, `center` for everything else. */
  align: "center" | "stretch";
  /** Grid span and stage height at each width. */
  span: string;
  stage: string;
  /**
   * Leave off phones, where a long single column would bury the rest of
   * the page: six tiles show there, then a link to the catalog.
   */
  wide?: boolean;
}

const EXAMPLES: readonly Example[] = [
  {
    Demo: TorusKnotDemo,
    align: "stretch",
    span: "sm:col-span-2 lg:col-span-4 lg:row-span-2",
    stage: "h-80 sm:h-[420px] lg:h-auto lg:flex-1",
    url: "/docs/scenes/torus-knot",
  },
  {
    Demo: BlackHoleDemo,
    align: "stretch",
    span: "lg:col-span-2",
    stage: "h-80",
    url: "/docs/scenes/black-hole",
  },
  {
    Demo: AsciiGlobeDemo,
    align: "stretch",
    span: "lg:col-span-2",
    stage: "h-80",
    url: "/docs/scenes/ascii-globe",
    wide: true,
  },
  {
    Demo: TerminalWindowDemo,
    align: "center",
    span: "sm:col-span-2 lg:col-span-3",
    stage: "h-[440px]",
    url: "/docs/interface/terminal-window",
  },
  {
    Demo: GlyphRainDemo,
    align: "stretch",
    span: "sm:col-span-2 lg:col-span-3",
    stage: "h-[440px]",
    url: "/docs/text/glyph-rain",
  },
  {
    Demo: DnaHelixDemo,
    align: "stretch",
    span: "lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/scenes/dna-helix",
    wide: true,
  },
  {
    Demo: SynthwaveSunDemo,
    align: "stretch",
    span: "lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/scenes/synthwave-sun",
    wide: true,
  },
  {
    Demo: AsciiCanvasDemo,
    align: "stretch",
    span: "sm:col-span-2 lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/images/ascii-canvas",
    wide: true,
  },
  {
    Demo: AsciiPortraitDemo,
    align: "center",
    span: "lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/images/ascii-portrait",
  },
  {
    Demo: AsciiCountdownDemo,
    align: "center",
    span: "lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/text/ascii-countdown",
  },
  {
    Demo: GlyphTrailDemo,
    align: "stretch",
    span: "sm:col-span-2 lg:col-span-2",
    stage: "h-[380px]",
    url: "/docs/interface/glyph-trail",
    wide: true,
  },
];

const ALIGN_CLASS = {
  center:
    "flex items-center-safe justify-center-safe p-6 sm:p-8 *:max-w-full *:min-w-0",
  stretch: "grid *:min-h-0 *:min-w-0",
} as const satisfies Record<Example["align"], string>;

const findPiece = (catalog: CatalogCategory[], url: string) => {
  for (const category of catalog) {
    const piece = category.pieces.find((item) => item.url === url);
    if (piece) {
      return { category: category.name, name: piece.name };
    }
  }
  return null;
};

const Tile = ({
  example,
  name,
  category,
}: {
  example: Example;
  name: string;
  category: string;
}) => {
  const { isNear, ref } = useNearViewport();
  const { Demo } = example;

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-[24px] border",
        example.span,
        example.wide && "max-sm:hidden"
      )}
    >
      <div
        ref={ref}
        className={cn(
          "bg-card text-card-foreground relative isolate w-full min-w-0 overflow-hidden [--ascii-paper:var(--card)] supports-[overflow:clip]:overflow-clip",
          ALIGN_CLASS[example.align],
          example.stage
        )}
      >
        {isNear ? <Demo /> : null}
      </div>
      <Link
        href={example.url}
        transitionTypes={["nav-forward"]}
        data-track="example_card_clicked"
        data-track-component-name={example.url.split("/").pop()}
        data-track-category={category}
        data-track-location="home_gallery"
        className="hover:bg-muted/40 focus-visible:ring-ring/60 flex items-baseline justify-between gap-3 border-t px-5 py-4 transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      >
        <span className="font-medium tracking-[-0.01em]">{name}</span>
        <span className="text-muted-foreground text-sm">{category}</span>
      </Link>
    </li>
  );
};

export const ExampleGallery = ({
  catalog,
  className,
}: {
  catalog: CatalogCategory[];
  className?: string;
}) => (
  <ul
    className={cn(
      "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6",
      className
    )}
  >
    {EXAMPLES.map((example) => {
      const piece = findPiece(catalog, example.url);
      return piece ? (
        <Tile
          key={example.url}
          example={example}
          name={piece.name}
          category={piece.category}
        />
      ) : null;
    })}
  </ul>
);

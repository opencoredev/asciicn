"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import {
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { BACKGROUNDS, HERO_BACKGROUNDS } from "@/lib/backgrounds";
import type { BackgroundEntry } from "@/lib/backgrounds";
import { cn } from "@/lib/utils";

/**
 * Site illustration, not a registry piece: the backgrounds behind the
 * landing hero, cities and landscapes. It opens on San Francisco, whose
 * orange bridge sits with the amber accent, then the next scene fades in
 * over it every HOLD_MS. Rotation pauses offscreen and in hidden tabs,
 * and never runs under reduced motion, where the city holds a still frame.
 *
 * Cities load one at a time, so the page only pays for the one on screen.
 * The dark plate shows through until the first one arrives.
 */

const HOLD_MS = 20_000;

/**
 * Stills of the opening scene, shown the moment the page paints and faded
 * out once the live scene has faded in over them, so the hero never opens
 * on an empty plate while the scene's code loads. Made with the hero's own
 * scene at 1440x900 and 390x844; the tall one matches its portrait framing.
 */
const POSTERS: Readonly<
  Record<string, Readonly<Record<Theme, { wide: string; tall: string }>>>
> = {
  "san-francisco": {
    dark: {
      tall: "/hero/san-francisco-tall.webp",
      wide: "/hero/san-francisco-wide.webp",
    },
    light: {
      tall: "/hero/san-francisco-light-tall.webp",
      wide: "/hero/san-francisco-light-wide.webp",
    },
  },
};

type Theme = "dark" | "light";

// The night skylines are drawn as dark shapes against lit windows, so on
// light paper they fall apart. The light theme keeps the scenes that read
// as a print: San Francisco on the site's paper, and Balloon valley, which
// is a light scene already.
const LIGHT_HERO: readonly BackgroundEntry[] = [
  "san-francisco",
  "balloon-valley",
].flatMap((id) => BACKGROUNDS.filter((entry) => entry.id === id));

const heroList = (theme: Theme) =>
  theme === "light" ? LIGHT_HERO : HERO_BACKGROUNDS;

type HeroScene = ComponentType<AsciiSceneProps & { paper?: AsciiColor }>;

/** Scenes that take the theme's paper in the light theme. */
const ON_LIGHT_PAPER: ReadonlySet<string> = new Set(["san-francisco"]);

// The scene switches to its portrait framing below this width-to-height ratio.
const PORTRAIT_QUERY = "(max-aspect-ratio: 85/100)";
const FADE_MS = 1600;

// Darkens the middle of the plate, from the headline down to the buttons,
// so the copy reads over the busiest skyline.
const SCRIM =
  "radial-gradient(ellipse var(--scrim-width) var(--scrim-height) at 50% var(--scrim-y), color-mix(in oklab, var(--background) 92%, transparent) 0%, color-mix(in oklab, var(--background) 84%, transparent) 55%, transparent 100%)";

interface Layer {
  readonly city: BackgroundEntry;
  /** Grows with every switch, so a city that comes round again remounts. */
  readonly key: number;
}

const nextCity = (
  list: readonly BackgroundEntry[],
  city: BackgroundEntry
): BackgroundEntry | undefined => list[(list.indexOf(city) + 1) % list.length];

/** One city, invisible until its chunk loads, then faded in. */
const CityLayer = ({
  city,
  paper,
  onShown,
}: {
  city: BackgroundEntry;
  /** Overrides the scene's own paper. */
  paper?: string;
  /** Called once the city is fully faded in. */
  onShown?: () => void;
}) => {
  const [Scene, setScene] = useState<HeroScene | null>(null);
  const shown = useRef(onShown);

  useEffect(() => {
    shown.current = onShown;
  }, [onShown]);

  useEffect(() => {
    let live = true;
    const show = async () => {
      try {
        const loaded = await city.load();
        if (live) {
          // Every background takes its own paper; the shared scene props
          // just don't declare it.
          setScene(() => loaded as HeroScene);
        }
      } catch {
        // A failed chunk leaves the plate (or the previous city) showing.
      }
    };
    show();
    return () => {
      live = false;
    };
  }, [city]);

  useEffect(() => {
    if (!Scene) {
      return;
    }
    const id = window.setTimeout(() => shown.current?.(), FADE_MS);
    return () => window.clearTimeout(id);
  }, [Scene]);

  return (
    <div
      className={cn(
        "absolute inset-0 opacity-0 transition-opacity ease-out motion-reduce:transition-none",
        Scene && "opacity-100"
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {Scene ? <Scene className="absolute inset-0" paper={paper} /> : null}
    </div>
  );
};

const HeroScenes = ({
  theme,
  rootRef,
}: {
  theme: Theme;
  rootRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const visible = useDocumentVisible();
  const reducedMotion = usePrefersReducedMotion();
  const list = heroList(theme);
  const [layers, setLayers] = useState<readonly Layer[]>(() => {
    const [city] = list;
    return city ? [{ city, key: 0 }] : [];
  });
  const [settled, setSettled] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const current = layers.at(-1);
  const poster = layers[0] ? POSTERS[layers[0].city.id]?.[theme] : undefined;

  const rotating =
    settled && !reducedMotion && inView && visible && list.length > 1;

  useEffect(() => {
    if (!rotating || !current) {
      return;
    }
    const id = window.setTimeout(() => {
      const city = nextCity(list, current.city);
      if (city) {
        setSettled(false);
        setLayers((previous) => [...previous, { city, key: current.key + 1 }]);
      }
    }, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [rotating, current, list]);

  // Once the newest city covers the plate, the ones under it can go.
  const settle = () => {
    setLayers((previous) => previous.slice(-1));
    setSettled(true);
    setPosterGone(true);
  };

  return (
    <>
      {poster && !posterGone ? (
        <picture>
          <source media={PORTRAIT_QUERY} srcSet={poster.tall} />
          {/* oxlint-disable-next-line nextjs/no-img-element -- a fixed-size still under the live scene, needed before hydration */}
          <img
            src={poster.wide}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
      ) : null}
      {layers.map((layer) => (
        <CityLayer
          key={layer.key}
          city={layer.city}
          paper={
            theme === "light" && ON_LIGHT_PAPER.has(layer.city.id)
              ? "--ascii-paper"
              : undefined
          }
          onShown={layer === current ? settle : undefined}
        />
      ))}
    </>
  );
};

const ThemedPosters = () => {
  const first = POSTERS[HERO_BACKGROUNDS[0]?.id ?? ""];
  if (!first) {
    return null;
  }
  return (["light", "dark"] as const).map((variant) => (
    <picture
      key={variant}
      className={variant === "dark" ? "hidden dark:block" : "dark:hidden"}
    >
      <source media={PORTRAIT_QUERY} srcSet={first[variant].tall} />
      {/* oxlint-disable-next-line nextjs/no-img-element -- a fixed-size still under the live scene, needed before hydration */}
      <img
        src={first[variant].wide}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  ));
};

/**
 * The server doesn't know the theme, so before hydration both posters are
 * in the page and CSS shows the one for the theme on <html>. After it, the
 * scenes for the resolved theme take over, and a theme switch starts that
 * theme's rotation from its first scene.
 */
export const AsciiHero = ({ className }: { className?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme: Theme | undefined =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : undefined;
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn("ascii-hero absolute inset-0", className)}
    >
      {theme ? (
        <HeroScenes key={theme} theme={theme} rootRef={rootRef} />
      ) : (
        <ThemedPosters />
      )}
      {/* Wider and shorter on phones, where the text column fills the
          width and the scene shows below it. */}
      <div
        className="absolute inset-0 [--scrim-height:30%] [--scrim-width:95%] [--scrim-y:40%] sm:[--scrim-height:40%] sm:[--scrim-width:50%] sm:[--scrim-y:52%]"
        style={{ background: SCRIM }}
      />
    </div>
  );
};

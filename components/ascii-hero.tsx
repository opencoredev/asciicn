"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import {
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { CITIES } from "@/lib/cities";
import type { CityEntry } from "@/lib/cities";
import { cn } from "@/lib/utils";

/**
 * Site illustration, not a registry piece: the city backgrounds behind the
 * landing hero. It opens on San Francisco, whose orange bridge sits with
 * the amber accent, then the next city fades in over it every HOLD_MS. Rotation pauses offscreen and in hidden tabs,
 * and never runs under reduced motion, where the city holds a still frame.
 *
 * Cities load one at a time, so the page only pays for the one on screen.
 * The dark plate shows through until the first one arrives.
 */

const HOLD_MS = 20_000;
const FADE_MS = 1600;

// Darkens the middle of the plate, from the headline down to the buttons,
// so the copy reads over the busiest skyline.
const SCRIM =
  "radial-gradient(ellipse var(--scrim-width) 40% at 50% 52%, color-mix(in oklab, var(--background) 92%, transparent) 0%, color-mix(in oklab, var(--background) 84%, transparent) 55%, transparent 100%)";

interface Layer {
  readonly city: CityEntry;
  /** Grows with every switch, so a city that comes round again remounts. */
  readonly key: number;
}

const FIRST_CITY = "san-francisco";

const firstCity = (): CityEntry | undefined =>
  CITIES.find((city) => city.id === FIRST_CITY) ?? CITIES[0];

const nextCity = (city: CityEntry): CityEntry | undefined =>
  CITIES[(CITIES.indexOf(city) + 1) % CITIES.length];

/** One city, invisible until its chunk loads, then faded in. */
const CityLayer = ({
  city,
  onShown,
}: {
  city: CityEntry;
  /** Called once the city is fully faded in. */
  onShown?: () => void;
}) => {
  const [Scene, setScene] = useState<ComponentType<AsciiSceneProps> | null>(
    null
  );
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
          setScene(() => loaded);
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
      {Scene ? <Scene className="absolute inset-0" /> : null}
    </div>
  );
};

export const AsciiHero = ({ className }: { className?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const visible = useDocumentVisible();
  const reducedMotion = usePrefersReducedMotion();
  const [layers, setLayers] = useState<readonly Layer[]>(() => {
    const city = firstCity();
    return city ? [{ city, key: 0 }] : [];
  });
  const [settled, setSettled] = useState(false);
  const current = layers.at(-1);

  const rotating =
    settled && !reducedMotion && inView && visible && CITIES.length > 1;

  useEffect(() => {
    if (!rotating || !current) {
      return;
    }
    const id = window.setTimeout(() => {
      const city = nextCity(current.city);
      if (city) {
        setSettled(false);
        setLayers((previous) => [...previous, { city, key: current.key + 1 }]);
      }
    }, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [rotating, current]);

  // Once the newest city covers the plate, the ones under it can go.
  const settle = () => {
    setLayers((previous) => previous.slice(-1));
    setSettled(true);
  };

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn("ascii-hero absolute inset-0", className)}
    >
      {layers.map((layer) => (
        <CityLayer
          key={layer.key}
          city={layer.city}
          onShown={layer === current ? settle : undefined}
        />
      ))}
      {/* Wider on phones, where the text column fills the plate. */}
      <div
        className="absolute inset-0 [--scrim-width:95%] sm:[--scrim-width:50%]"
        style={{ background: SCRIM }}
      />
    </div>
  );
};

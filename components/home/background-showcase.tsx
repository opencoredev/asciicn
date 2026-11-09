"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import { CityStill } from "@/components/home/city-still";
import { CITY_SOURCES } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import { usePrefersReducedMotion } from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { cn } from "@/lib/utils";

/** How many backgrounds the landing shows; the gallery has the rest. */
const SHOWN = 8;

/**
 * The live scene over a card's print while it is hovered or focused. One
 * plays at a time, so the landing never holds more than one extra WebGL
 * context, and nothing plays under reduced motion.
 */
const LiveScene = ({ source }: { source: StageSource }) => {
  const [Scene, setScene] = useState<ComponentType<AsciiSceneProps> | null>(
    null
  );
  useEffect(() => {
    let live = true;
    const show = async () => {
      try {
        const loaded = await source.load();
        if (live) {
          setScene(() => loaded);
        }
      } catch {
        // The print stays.
      }
    };
    show();
    return () => {
      live = false;
    };
  }, [source]);
  return Scene ? <Scene className="absolute inset-0" /> : null;
};

/** A row of painted backgrounds for the landing, prints that play on hover. */
export const BackgroundShowcase = ({ className }: { className?: string }) => {
  const [active, setActive] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  return (
    <ul
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
      onMouseLeave={() => setActive(null)}
    >
      {CITY_SOURCES.slice(0, SHOWN).map((source) => (
        <li key={source.id}>
          <Link
            href={source.href}
            transitionTypes={["nav-forward"]}
            data-track="background_card_clicked"
            data-track-component-name={source.id}
            data-track-location="home_backgrounds"
            onMouseEnter={() => setActive(source.id)}
            onFocus={() => setActive(source.id)}
            onBlur={() => setActive(null)}
            className="group/bg focus-visible:ring-ring/60 flex flex-col overflow-hidden rounded-[20px] border outline-none focus-visible:ring-[3px]"
          >
            <div className="relative aspect-video overflow-hidden">
              <CityStill source={source} className="absolute inset-0" />
              {active === source.id && !reducedMotion ? (
                <LiveScene source={source} />
              ) : null}
            </div>
            <span className="flex items-baseline justify-between gap-3 border-t px-4 py-3">
              <span className="font-medium tracking-[-0.01em]">
                {source.title}
              </span>
              <span className="text-muted-foreground text-sm">
                {source.group === "landscapes" ? "Landscape" : "City"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

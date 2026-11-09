"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import { printSrc } from "@/components/home/city-still";
import { loadSource } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { cn } from "@/lib/utils";

/**
 * One background, live and edge to edge, with nothing drawn over it. The
 * catalog print sits underneath, so a switch shows the new scene at once
 * while its chunk loads, and the print stays if the chunk fails.
 */

type Loaded =
  | {
      readonly kind: "ready";
      readonly id: string;
      readonly Component: ComponentType<AsciiSceneProps>;
    }
  | { readonly kind: "failed"; readonly id: string };

const useLoadedSource = (source: StageSource): Loaded | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const Component = await loadSource(source);
        if (live) {
          setLoaded({ Component, id: source.id, kind: "ready" });
        }
      } catch {
        if (live) {
          setLoaded({ id: source.id, kind: "failed" });
        }
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [source]);
  return loaded;
};

export interface StageProps {
  /** The background to draw. */
  source: StageSource;
  /** Set the stage's height here. */
  className?: string;
}

export const Stage = ({ source, className }: StageProps) => {
  const loaded = useLoadedSource(source);
  return (
    <div
      className={cn(
        "bg-ascii-paper relative overflow-hidden rounded-[20px] border",
        className
      )}
    >
      {/* oxlint-disable-next-line nextjs/no-img-element -- a static print, already sized and compressed */}
      <img
        key={`print-${source.id}`}
        src={printSrc(source)}
        alt=""
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      {loaded?.kind === "ready" && loaded.id === source.id ? (
        <loaded.Component
          key={`scene-${loaded.id}`}
          className="absolute inset-0"
        />
      ) : null}
    </div>
  );
};

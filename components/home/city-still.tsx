"use client";

import { useStill } from "@/components/home/city-stills";
import { charsetSweep, FramePre } from "@/components/home/frame-pre";
import type { StageSource } from "@/components/home/sources";
import { cn } from "@/lib/utils";

/**
 * A city's still frame as text, filling a 16:9 box. Until the still is
 * baked (or if it can't be), the city's charset swept across the box.
 */
export const CityStill = ({
  source,
  className,
}: {
  source: StageSource;
  className?: string;
}) => {
  const still = useStill(source.id);
  return (
    <div
      className={cn(
        "bg-ascii-paper @container relative aspect-video overflow-hidden",
        className
      )}
    >
      {still ? (
        <FramePre
          frame={still.frame}
          className="absolute inset-0"
          style={still.paper ? { background: still.paper } : undefined}
        />
      ) : (
        <FramePre
          frame={charsetSweep(source.charset)}
          className={cn(
            "absolute inset-0 opacity-35 transition-opacity duration-300",
            still === undefined && "motion-safe:animate-pulse"
          )}
        />
      )}
    </div>
  );
};

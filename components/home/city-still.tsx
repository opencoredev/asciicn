import type { StageSource } from "@/components/home/sources";
import { cn } from "@/lib/utils";

/**
 * A background's print filling a 16:9 card: the screenshot made by
 * `pnpm catalog:capture`, so the card shows the real scene the moment the
 * page loads, with no WebGL context. The backgrounds paint their own paper,
 * so the dark-theme print serves both themes.
 */
export const printSrc = (source: StageSource) =>
  `${source.href.replace(/^\/docs\//u, "/catalog/")}-dark.webp`;

export const CityStill = ({
  source,
  className,
}: {
  source: StageSource;
  className?: string;
}) => (
  <div
    className={cn(
      "bg-ascii-paper relative aspect-video overflow-hidden",
      className
    )}
  >
    {/* oxlint-disable-next-line nextjs/no-img-element -- a static print, already sized and compressed */}
    <img
      src={printSrc(source)}
      alt=""
      loading="lazy"
      decoding="async"
      className="absolute inset-0 size-full object-cover"
    />
  </div>
);

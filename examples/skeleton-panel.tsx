import { Skeleton } from "@/components/asciicn/skeleton";

const TILES = ["Build", "Tests", "Deploy"] as const;

export default function SkeletonPanel() {
  return (
    <div aria-busy="true" className="flex w-full max-w-xl flex-col gap-3">
      <span className="sr-only">Loading the pipeline</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TILES.map((title) => (
          <div
            key={title}
            className="bg-background flex flex-col gap-3 rounded-lg border p-4"
          >
            {/* Real labels stay; only the numbers are still loading. */}
            <span className="text-muted-foreground text-xs">{title}</span>
            <Skeleton color="ink" rows={2} cell={14} className="w-24" />
            <Skeleton rows={1} className="w-16" />
          </div>
        ))}
      </div>
      <div className="bg-background flex flex-col gap-4 rounded-lg border p-4">
        <span className="text-muted-foreground text-xs">Build log</span>
        <Skeleton color="ink" chars="·•●" rows={10} />
      </div>
    </div>
  );
}

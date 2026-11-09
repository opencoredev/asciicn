import { BlackHole } from "@/components/asciicn/black-hole";

const TILTS = [0, 8, 24] as const;

export default function BlackHoleTilts() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
      {TILTS.map((tilt) => (
        <figure
          key={tilt}
          className="relative isolate aspect-[4/3] overflow-hidden rounded-md border"
        >
          <BlackHole tilt={tilt} cell={10} className="absolute inset-0 -z-10" />
          <figcaption className="bg-background/80 absolute bottom-2 left-2 rounded-md px-2 py-0.5 font-mono text-xs">
            tilt={"{"}
            {tilt}
            {"}"}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

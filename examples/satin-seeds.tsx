import { Satin } from "@/components/asciicn/satin";

const SEEDS = ["orchid", "ribbon-3", "plush"] as const;

export default function SatinSeeds() {
  return (
    <div className="grid size-full grid-cols-3 gap-px">
      {SEEDS.map((seed) => (
        <figure
          key={seed}
          className="relative isolate min-h-40 overflow-hidden"
        >
          <Satin seed={seed} className="absolute inset-0 -z-10" />
          <figcaption className="bg-background/80 absolute bottom-2 left-2 rounded-md px-2 py-0.5 font-mono text-xs">
            seed=&quot;{seed}&quot;
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

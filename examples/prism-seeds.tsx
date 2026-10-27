import { Prism } from "@/components/asciicn/prism";

const SEEDS = ["glasswing", "refract", "halcyon"] as const;

export default function PrismSeeds() {
  return (
    <div className="grid size-full grid-cols-3 gap-px">
      {SEEDS.map((seed) => (
        <figure
          key={seed}
          className="relative isolate min-h-40 overflow-hidden"
        >
          <Prism seed={seed} className="absolute inset-0 -z-10" />
          <figcaption className="bg-background/80 absolute bottom-2 left-2 rounded-md px-2 py-0.5 font-mono text-xs">
            seed=&quot;{seed}&quot;
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

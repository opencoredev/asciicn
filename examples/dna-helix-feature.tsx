import { DnaHelix } from "@/components/asciicn/dna-helix";

export default function DnaHelixFeature() {
  return (
    <section className="grid w-full max-w-3xl items-center gap-6 sm:grid-cols-[1fr_minmax(0,16rem)]">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          Sequencing · run 0417
        </p>
        <h3 className="text-balance font-medium text-3xl tracking-[-0.03em]">
          Read a genome before your coffee cools
        </h3>
        <p className="text-pretty text-muted-foreground text-sm">
          Whole-genome runs in 41 minutes at 30x coverage, with variant calls
          streamed to your pipeline as each lane finishes.
        </p>
      </div>
      <DnaHelix
        cell={8}
        speed={0.45}
        scroll={0.6}
        interactive={false}
        background="transparent"
        className="h-80 w-full sm:h-96"
      />
    </section>
  );
}

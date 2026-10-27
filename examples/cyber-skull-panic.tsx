import { CyberSkull } from "@/components/asciicn/cyber-skull";

export default function CyberSkullPanic() {
  return (
    <section className="grid w-full max-w-2xl items-center gap-6 border bg-background p-6 font-mono sm:grid-cols-[minmax(0,15rem)_1fr]">
      <CyberSkull
        shading="wire"
        charset="braille"
        accent="red"
        jaw={false}
        speed={0.4}
        interactive={false}
        className="aspect-square w-full"
      />
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          Error 500 · worker-3
        </p>
        <h3 className="text-balance font-medium text-2xl tracking-[-0.02em]">
          The build died on step 4 of 7
        </h3>
        <p className="text-pretty text-muted-foreground">
          Out of memory while bundling the client. We kept the logs and
          restarted the queue.
        </p>
        <span className="text-muted-foreground text-xs">
          exit 137 · 2.1 GB peak
        </span>
      </div>
    </section>
  );
}

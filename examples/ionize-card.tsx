import { Ionize } from "@/components/asciicn/ionize";

export default function IonizeCard() {
  return (
    <div className="flex size-full items-center justify-center p-6">
      <article className="relative isolate flex w-full max-w-sm flex-col gap-2 overflow-hidden rounded-2xl border p-6">
        <Ionize
          seed="coil"
          intensity={0.5}
          cell={10}
          className="absolute inset-0 -z-10"
        />
        <p className="text-muted-foreground font-mono text-xs">
          v2.4 · build 1180
        </p>
        <h3 className="text-xl font-medium tracking-[-0.02em]">
          Edge functions, now 3× faster
        </h3>
        <p className="text-muted-foreground text-sm text-pretty">
          Cold starts dropped from 140 ms to 45 ms on every region.
        </p>
      </article>
    </div>
  );
}

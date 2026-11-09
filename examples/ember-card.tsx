import { Ember } from "@/components/asciicn/ember";

export default function EmberCard() {
  return (
    <div className="flex size-full items-center justify-center p-6">
      <article className="relative isolate flex w-full max-w-sm flex-col gap-2 overflow-hidden rounded-2xl border p-6 pb-24">
        <p className="text-muted-foreground font-mono text-xs">
          streak · 12 days
        </p>
        <h3 className="text-xl font-medium tracking-[-0.02em]">
          You are on fire
        </h3>
        <p className="text-muted-foreground text-sm text-pretty">
          Ship one more change today to keep the streak alive.
        </p>
        <Ember
          intensity={1.5}
          sparks={0.3}
          cell={10}
          className="absolute inset-x-0 bottom-0 -z-10 h-24"
        />
      </article>
    </div>
  );
}

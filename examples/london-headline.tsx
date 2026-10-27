import { London } from "@/components/asciicn/london";

export default function LondonHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-2 px-8 pb-8 text-left sm:px-12 sm:pb-10">
      <London intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-2xl font-medium tracking-[-0.03em] text-balance text-white sm:text-3xl">
        Evening sessions, London
      </h3>
      <p className="max-w-xs text-sm text-pretty text-white/70">
        At 0.6 intensity the city sits back and the river leaves room for the
        headline.
      </p>
    </section>
  );
}

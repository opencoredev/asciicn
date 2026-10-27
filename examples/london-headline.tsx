import { London } from "@/components/asciicn/london";

export default function LondonHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-center gap-3 px-8 text-left sm:px-12">
      <London intensity={0.6} fog={0.7} className="absolute inset-0 -z-10" />
      <h3 className="max-w-sm text-3xl font-medium tracking-[-0.03em] text-balance text-white sm:text-4xl">
        Evening sessions, London
      </h3>
      <p className="max-w-xs text-sm text-pretty text-white/70">
        At 0.6 intensity the city fades into the fog and the headline reads
        first.
      </p>
    </section>
  );
}

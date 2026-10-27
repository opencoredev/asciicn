import { Paris } from "@/components/asciicn/paris";

export default function ParisHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-center gap-3 px-8 text-left sm:px-12">
      <Paris intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-sm text-3xl font-medium tracking-[-0.03em] text-balance text-white sm:text-4xl">
        Summit week, Paris
      </h3>
      <p className="max-w-xs text-sm text-pretty text-white/70">
        At 0.6 intensity the city sits back and the headline reads first.
      </p>
    </section>
  );
}

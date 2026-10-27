import { Rio } from "@/components/asciicn/rio";

// Gold duotone at reduced intensity, so the headline reads first.
export default function RioHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-3 px-8 pb-10 text-left sm:px-12 sm:pb-12">
      <Rio
        colorMode="duotone"
        ramp="sodium"
        intensity={0.6}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-sm text-3xl font-medium tracking-[-0.03em] text-balance text-white sm:text-4xl">
        Offsite week, Rio
      </h3>
      <p className="max-w-xs text-sm text-pretty text-white/70">
        At 0.6 intensity the bay sits back and the headline reads first.
      </p>
    </section>
  );
}

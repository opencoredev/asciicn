import { BlackHoleScene } from "@/components/asciicn/scenes/black-hole-scene";

export default function BlackHoleSceneHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-end gap-2 overflow-hidden px-6 pb-10 text-center text-white">
      <BlackHoleScene tilt={3} stars={1.4} className="absolute inset-0 -z-10" />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Nothing escapes the queue
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        Edge on, the disk is a single bright line and the far side arches over
        the shadow.
      </p>
    </section>
  );
}

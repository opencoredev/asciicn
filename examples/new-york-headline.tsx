import { NewYork } from "@/components/asciicn/new-york";

export default function NewYorkHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-2 px-8 pb-8 text-left sm:px-12 sm:pb-10">
      <NewYork
        intensity={0.55}
        windows={0.7}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-2xl font-medium tracking-[-0.03em] text-balance text-white sm:text-3xl">
        Ship night, New York
      </h3>
      <p className="max-w-xs text-sm text-pretty text-white/70">
        At 0.55 intensity the skyline sits back and the river leaves room for
        the headline.
      </p>
    </section>
  );
}

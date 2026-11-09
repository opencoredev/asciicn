import { NewYork } from "@/components/asciicn/new-york";
import { Button } from "@/components/ui/button";

export default function NewYorkHero() {
  return (
    <section className="relative isolate flex size-full min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <NewYork intensity={0.6} className="absolute inset-0 -z-10" />
      <h3 className="max-w-lg text-3xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
        Ship before the lights come on
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/75">
        At 0.6 intensity the skyline steps back and the headline reads first.
      </p>
      <div className="mt-1 flex gap-2">
        <Button size="sm" className="bg-white text-black hover:bg-white/90">
          Get started
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white"
        >
          Read the docs
        </Button>
      </div>
    </section>
  );
}

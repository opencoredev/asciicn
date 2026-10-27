import { CampfireWoodsScene } from "@/components/asciicn/scenes/campfire-woods-scene";

export default function CampfireWoodsSceneHero() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center text-white">
      <CampfireWoodsScene
        charset="dense"
        fireflies={12}
        smoke={0.6}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
        Office hours, after dark
      </h3>
      <p className="max-w-sm text-sm text-pretty text-white/70">
        The sky above the pines stays quiet enough to carry a headline.
      </p>
    </section>
  );
}

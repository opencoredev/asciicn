import { WovenBannerScene } from "@/components/asciicn/scenes/woven-banner-scene";

export default function WovenBannerScenePhosphor() {
  return (
    <WovenBannerScene
      charset="braille"
      colorMode="mono"
      phosphor="p1"
      text="SIGNAL"
      wind={1.4}
      gusts={1.6}
      fx={{ bloom: 0.45, scanlines: 0.35, vignette: 0.4 }}
      className="absolute inset-0"
    />
  );
}

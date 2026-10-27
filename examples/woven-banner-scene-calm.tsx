import { WovenBannerScene } from "@/components/asciicn/scenes/woven-banner-scene";

export default function WovenBannerSceneCalm() {
  return (
    <WovenBannerScene
      charset="dense"
      colorMode="duotone"
      ramp="glacier"
      text="OPEN 24 HOURS"
      colors={["#24306e", "#e9edf7", "#8fb3ff"]}
      wind={0.6}
      gusts={0.3}
      streaks={false}
      fx={{}}
      className="absolute inset-0"
    />
  );
}

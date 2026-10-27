import { AbyssalJellyfishScene } from "@/components/asciicn/scenes/abyssal-jellyfish-scene";

export default function AbyssalJellyfishSceneGlacier() {
  return (
    <AbyssalJellyfishScene
      charset="dense"
      colorMode="duotone"
      ramp="glacier"
      jellies={7}
      size={0.7}
      push={-0.8}
      className="absolute inset-0"
    />
  );
}

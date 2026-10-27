import { AbyssalJellyfishScene } from "@/components/asciicn/scenes/abyssal-jellyfish-scene";

export default function AbyssalJellyfishSceneBraille() {
  return (
    <AbyssalJellyfishScene
      charset="braille"
      jellies={4}
      size={1.3}
      tentacles={1.2}
      className="absolute inset-0"
    />
  );
}

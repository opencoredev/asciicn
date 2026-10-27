import { ImageCompare } from "@/components/asciicn/image-compare";

export default function ImageCompareLooks() {
  return (
    <ImageCompare
      src="/examples/tetons.jpg"
      alt="The Tetons in Braille on the left and in ANSI blocks through the sodium ramp on the right"
      charset="braille"
      colorMode="mono"
      against={{ charset: "blocks", colorMode: "duotone", ramp: "sodium" }}
      labels={["braille", "blocks · sodium"]}
      defaultPosition={0.45}
      cell={9}
      className="aspect-[5/4] w-full max-w-2xl"
    />
  );
}

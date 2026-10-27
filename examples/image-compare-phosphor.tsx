import { ImageCompare } from "@/components/asciicn/image-compare";

export default function ImageComparePhosphor() {
  return (
    <ImageCompare
      src="/examples/tetons.jpg"
      alt="The Tetons as green phosphor glyphs on the left and the original print on the right"
      charset="standard"
      colorMode="mono"
      phosphor="p1"
      labels={["p1 phosphor", "print"]}
      defaultPosition={0.62}
      cell={8}
      className="aspect-[5/4] w-full max-w-2xl"
    />
  );
}

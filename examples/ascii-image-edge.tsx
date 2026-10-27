import { AsciiImage } from "@/components/asciicn/ascii-image";

export default function AsciiImageEdge() {
  return (
    <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
      <AsciiImage
        src="/examples/tetons.jpg"
        alt="The Teton Range above the Snake River, drawn as Sobel edge strokes"
        charset="edge"
        colorMode="mono"
        edgeThreshold={0.18}
        cell={9}
        className="aspect-[5/4] w-full"
      />
      <AsciiImage
        src="/examples/tetons.jpg"
        alt="The same view in ANSI blocks with a sodium duotone"
        charset="blocks"
        colorMode="duotone"
        ramp="sodium"
        cell={9}
        className="aspect-[5/4] w-full"
      />
    </div>
  );
}

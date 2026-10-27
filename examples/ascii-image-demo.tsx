"use client";

import { AsciiImage } from "@/components/asciicn/ascii-image";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-image-controls";

export default function AsciiImageDemo() {
  const preset = usePreviewValue(knobs.preset);
  const color = usePreviewValue(knobs.ink);
  const method = usePreviewValue(knobs.method);
  const sharpen = usePreviewValue(knobs.sharpen);
  const invert = usePreviewValue(knobs.invert);

  return (
    <AsciiImage
      src="/examples/aldrin.jpg"
      alt="Buzz Aldrin standing on the Moon during Apollo 11, his visor reflecting the photographer"
      preset={preset}
      color={color}
      method={method === "preset" ? undefined : method}
      sharpen={sharpen}
      invert={invert}
      ratio={4 / 5}
      className="w-full max-w-sm rounded-xl"
    />
  );
}

"use client";

import { AsciiVideo } from "@/components/asciicn/ascii-video";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-video-controls";

export default function AsciiVideoDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const cell = usePreviewValue(knobs.cell);
  const fps = usePreviewValue(knobs.fps);
  const mirror = usePreviewValue(knobs.mirror);

  return (
    <AsciiVideo
      src="/examples/video/liftoff.mp4"
      alt="Apollo 11 lifting off from the launch pad on a column of fire"
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      fps={fps}
      mirror={mirror}
      audioReactive
      className="aspect-[4/3] w-full max-w-2xl"
    />
  );
}

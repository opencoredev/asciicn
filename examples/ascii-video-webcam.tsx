import { AsciiVideo } from "@/components/asciicn/ascii-video";

export default function AsciiVideoWebcam() {
  return (
    <AsciiVideo
      alt="Your camera, drawn in green phosphor Braille"
      charset="braille"
      colorMode="mono"
      phosphor="p1"
      autoLevels
      audioReactive
      cell={9}
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}

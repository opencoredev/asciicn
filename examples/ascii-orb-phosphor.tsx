import { AsciiOrb } from "@/components/asciicn/ascii-orb";

export default function AsciiOrbPhosphor() {
  return (
    <AsciiOrb
      state="listening"
      charset="standard"
      colorMode="mono"
      phosphor="blueprint"
      morph={1.6}
      glow={0.9}
      cell={11}
      className="aspect-[16/9] w-full max-w-xl"
    />
  );
}

import { AsciiImage } from "@/components/asciicn/ascii-image";

export default function AsciiImagePhosphor() {
  return (
    <AsciiImage
      src="/examples/earthrise.jpg"
      alt="Earth rising over the grey horizon of the Moon, seen from Apollo 8"
      charset="braille"
      colorMode="mono"
      phosphor="p3"
      cell={9}
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}

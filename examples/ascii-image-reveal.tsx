import { AsciiImage } from "@/components/asciicn/ascii-image";

export default function AsciiImageReveal() {
  return (
    <AsciiImage
      src="/examples/pillars.jpg"
      alt="The Pillars of Creation, towers of gas and dust in the Eagle Nebula"
      charset="dense"
      reveal="photo"
      revealRadius={140}
      cell={8}
      className="aspect-[4/5] w-full max-w-sm"
    />
  );
}

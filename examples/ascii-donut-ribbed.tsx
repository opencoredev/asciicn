import { AsciiDonut } from "@/components/asciicn/ascii-donut";

export default function AsciiDonutRibbed() {
  return (
    <AsciiDonut
      surface="ribbed"
      charset="braille"
      colorMode="duotone"
      ramp="glacier"
      thickness={0.32}
      radius={0.58}
      spin={[0.4, 0.9]}
      cell={9}
      className="aspect-[4/3] w-full max-w-xl"
    />
  );
}

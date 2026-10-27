import { Silk } from "@/components/asciicn/silk";

export default function SilkChampagne() {
  return (
    <Silk
      folds={8}
      angle={135}
      sheen={0.85}
      charset="blocks"
      colorMode="truecolor"
      palette={[
        "--ascii-paper",
        "oklch(0.36 0.06 60)",
        "oklch(0.62 0.11 75)",
        "oklch(0.8 0.1 85)",
        "oklch(0.95 0.04 95)",
      ]}
      className="absolute inset-0"
    />
  );
}

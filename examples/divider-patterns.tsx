import { Divider } from "@/components/asciicn/divider";
import type { DividerVariant } from "@/components/asciicn/divider";

const VARIANTS: readonly DividerVariant[] = [
  "light",
  "heavy",
  "double",
  "dashed",
  "ascii",
  "dots",
  "beads",
  "diamonds",
];

export default function DividerPatterns() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      {VARIANTS.map((variant) => (
        <Divider
          key={variant}
          variant={variant}
          label={variant}
          align="start"
        />
      ))}
      <Divider variant="light" ornament="◆" color="orange" />
    </div>
  );
}

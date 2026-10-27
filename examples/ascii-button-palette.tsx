import { AsciiButton } from "@/components/asciicn/ascii-button";
import { FILL_VARIANTS } from "@/lib/ascii";
import type { AsciiColorName } from "@/lib/ascii";

const COLORS: readonly AsciiColorName[] = ["blue", "green", "orange", "pink"];

export default function AsciiButtonPalette() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {FILL_VARIANTS.map((fill) =>
        COLORS.map((color) => (
          <AsciiButton key={`${fill}-${color}`} fill={fill} color={color}>
            {fill}
          </AsciiButton>
        ))
      )}
      {COLORS.map((color) => (
        <AsciiButton key={`outline-${color}`} variant="outline" color={color}>
          outline
        </AsciiButton>
      ))}
    </div>
  );
}

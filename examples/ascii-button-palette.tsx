import {
  ASCII_BUTTON_FRAMES,
  ASCII_BUTTON_VARIANTS,
  AsciiButton,
} from "@/components/asciicn/ascii-button";

const COLORS = ["ink", "green", "orange", "red"] as const;

export default function AsciiButtonPalette() {
  return (
    <div className="flex flex-col items-center gap-6">
      {ASCII_BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap justify-center gap-4">
          {COLORS.map((color, index) => (
            <AsciiButton
              key={color}
              variant={variant}
              color={color}
              frame={
                ASCII_BUTTON_FRAMES[
                  (index + ASCII_BUTTON_VARIANTS.indexOf(variant)) %
                    ASCII_BUTTON_FRAMES.length
                ]
              }
            >
              {variant}
            </AsciiButton>
          ))}
        </div>
      ))}
    </div>
  );
}

import { AsciiText } from "@/components/asciicn/ascii-text";

export default function AsciiTextBanner() {
  return (
    <AsciiText
      as="h3"
      charset="blocks"
      colorMode="duotone"
      ramp="outrun"
      cell={10}
      size={88}
      className="w-full font-display font-extrabold tracking-tight"
    >
      {"SYSTEM\nONLINE"}
    </AsciiText>
  );
}

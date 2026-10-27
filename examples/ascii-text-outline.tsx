import { AsciiText } from "@/components/asciicn/ascii-text";

export default function AsciiTextOutline() {
  return (
    <AsciiText
      as="h3"
      charset="edge"
      edgeThreshold={0.18}
      color="blue"
      cell={9}
      size={150}
      className="w-full font-sans font-black"
    >
      Edge
    </AsciiText>
  );
}

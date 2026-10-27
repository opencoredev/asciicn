import { AsciiMarquee } from "@/components/asciicn/ascii-marquee";

const NOTES = [
  "v2.0 is out",
  "ten city skylines",
  "braille, quadrants and CP437 in every renderer",
  "export to .txt .ans .svg .png",
] as const;

export default function AsciiMarqueeBanner() {
  return (
    <div className="w-full max-w-3xl text-muted-foreground">
      <AsciiMarquee
        items={NOTES}
        frame="none"
        motion="smooth"
        separator="※"
        speed={6}
        cell={14}
      />
    </div>
  );
}

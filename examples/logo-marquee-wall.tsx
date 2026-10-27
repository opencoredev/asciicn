import { LogoMarquee } from "@/components/asciicn/logo-marquee";
import { LOGOS } from "@/examples/ascii-logo-data";

// Each logo links to its case study, so the wall works from the keyboard.
const LINKED = LOGOS.map((logo) => ({ ...logo, href: "#customers" }));

export default function LogoMarqueeWall() {
  return (
    <LogoMarquee
      variant="wall"
      logos={LINKED}
      label="Customers"
      rows={5}
      gap={6}
      className="max-w-2xl"
    />
  );
}

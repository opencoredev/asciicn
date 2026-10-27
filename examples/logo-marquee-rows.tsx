import { LogoMarquee } from "@/components/asciicn/logo-marquee";
import { LOGOS } from "@/examples/ascii-logo-data";

export default function LogoMarqueeRows() {
  return (
    <div className="flex w-full flex-col gap-6">
      <LogoMarquee logos={LOGOS} label="Customers" speed={10} color="ink" />
      <LogoMarquee
        logos={LOGOS.toReversed()}
        label="Partners"
        speed={10}
        direction="right"
        charset="braille"
        rows={8}
      />
    </div>
  );
}

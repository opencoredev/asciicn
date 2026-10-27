import { LogoMarquee } from "@/components/asciicn/logo-marquee";
import { LOGOS } from "@/examples/ascii-logo-data";

export default function LogoMarqueeRows() {
  return (
    <div className="flex w-full flex-col gap-4">
      <LogoMarquee
        logos={LOGOS}
        label="Customers"
        speed={24}
        fade="dither"
        fill="solid"
      />
      <LogoMarquee
        logos={LOGOS.toReversed()}
        label="Partners"
        speed={24}
        direction="right"
        fade="dither"
        fill="hatched"
        color="grey"
      />
    </div>
  );
}

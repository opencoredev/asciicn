import { Contours } from "@/components/asciicn/contours";

// A printed survey sheet: green lowland, brown peaks, parchment paper.
export default function ContoursSurvey() {
  return (
    <div className="absolute inset-0 bg-[oklch(0.95_0.02_85)]">
      <Contours
        colorMode="truecolor"
        lines={18}
        scale={0.8}
        relief={0.6}
        paper="oklch(0.95 0.02 85)"
        lineColor="oklch(0.55 0.11 145)"
        ink="oklch(0.45 0.11 55)"
        className="absolute inset-0"
      />
      <div className="absolute right-4 bottom-4 border border-[oklch(0.45_0.11_55)] bg-[oklch(0.95_0.02_85)] px-2 py-1 font-mono text-[11px] text-[oklch(0.35_0.08_55)]">
        SHEET 42 · 1:25 000 · 10 m
      </div>
    </div>
  );
}

import { Sydney } from "@/components/asciicn/sydney";

// The tone runs through a two-colour ramp, drawn in fine Braille dots.
export default function SydneyDuotone() {
  return (
    <div className="relative isolate h-80 w-full max-w-2xl overflow-hidden rounded-xl border border-border">
      <Sydney
        charset="braille"
        colorMode="duotone"
        ramp="glacier"
        cell={8}
        ferry={false}
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}

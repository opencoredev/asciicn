import { DissolveText } from "@/components/asciicn/dissolve-text";

const RAMPS = [
  { charset: "blocks", label: "blocks" },
  { charset: "quadrants", label: "quadrants" },
  { charset: "braille", label: "braille" },
  { charset: "dots", label: "dots" },
] as const;

export default function DissolveTextRamps() {
  return (
    <dl className="grid gap-x-8 gap-y-4 font-mono sm:grid-cols-2">
      {RAMPS.map(({ charset, label }) => (
        <div key={label} className="flex items-baseline gap-4">
          <dt className="w-[10ch] text-xs text-muted-foreground">{label}</dt>
          <dd>
            <DissolveText
              charset={charset}
              duration={0.9}
              stagger={0.06}
              className="text-xl font-bold"
            >
              ASSEMBLE
            </DissolveText>
          </dd>
        </div>
      ))}
    </dl>
  );
}

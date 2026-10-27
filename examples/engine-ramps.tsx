import {
  AsciiPre,
  fillToneField,
  mapTones,
  createToneField,
  RAMP_NAMES,
} from "@/lib/ascii";

const COLUMNS = 44;

// Each duotone ramp along a left-to-right tone gradient, rendered on the
// server as a <pre>: no canvas, no JavaScript.
const strip = (ramp: (typeof RAMP_NAMES)[number]) => {
  const field = createToneField(COLUMNS, 1, "blocks");
  fillToneField(field, (u) => u);
  return mapTones(field, COLUMNS, 1, {
    charset: "blocks",
    colorMode: "duotone",
    dither: "bayer4",
    ramp,
  });
};

export default function EngineRamps() {
  return (
    <div className="w-full overflow-x-auto rounded-md bg-[#07070b] p-4">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
        {RAMP_NAMES.map((ramp) => (
          <div key={ramp} className="contents">
            <dt className="font-mono text-xs text-zinc-400">{ramp}</dt>
            <dd>
              <AsciiPre frame={strip(ramp)} cell={14} aria-hidden="true" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

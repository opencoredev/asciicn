import {
  ASCII_NUMBER_FONTS,
  AsciiNumber,
} from "@/components/asciicn/ascii-number";

export default function AsciiNumberFonts() {
  return (
    <dl className="grid gap-6 sm:grid-cols-2">
      {ASCII_NUMBER_FONTS.map((font) => (
        <div key={font} className="flex flex-col gap-2">
          <dt className="font-mono text-xs text-muted-foreground">{font}</dt>
          <dd>
            <AsciiNumber
              value={1_234_567.89}
              locale="de-DE"
              format={{ maximumFractionDigits: 2 }}
              font={font}
              cell={10}
              animate={false}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

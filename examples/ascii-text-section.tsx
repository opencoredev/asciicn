import { AsciiText } from "@/components/asciicn/ascii-text";

export default function AsciiTextSection() {
  return (
    <section className="flex w-full max-w-lg flex-col gap-3 px-6">
      <span className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
        Changelog · October
      </span>
      <AsciiText
        as="h3"
        direction="right"
        from={1}
        to={0.55}
        color="--foreground"
        animate={false}
        className="text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
      >
        Exports land in every format
      </AsciiText>
      <p className="text-muted-foreground text-sm text-pretty">
        PNG, SVG and CSS exports from the maker, with the palette and cell size
        you picked. The heading thins out left to right in the page&apos;s own
        foreground colour, so it works on light and dark themes.
      </p>
    </section>
  );
}

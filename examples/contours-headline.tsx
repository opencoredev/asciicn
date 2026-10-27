import { Contours } from "@/components/asciicn/contours";

export default function ContoursHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-start justify-end gap-3 px-6 pb-12 sm:px-10 sm:pb-16">
      <Contours
        lines={9}
        index={0}
        relief={0}
        speed={0.6}
        palette={[
          "--ascii-paper",
          "color-mix(in oklch, var(--ascii-ink) 20%, var(--ascii-paper))",
          "color-mix(in oklch, var(--ascii-ink) 38%, var(--ascii-paper))",
        ]}
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        Know the ground before you build on it
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        Thin lines in two soft tints, with no index lines and no shading, stay
        quiet behind text.
      </p>
    </section>
  );
}

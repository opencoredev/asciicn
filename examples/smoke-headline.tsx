import { Smoke } from "@/components/asciicn/smoke";

export default function SmokeHeadline() {
  return (
    <section className="relative isolate flex size-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center sm:pt-20">
      <Smoke
        height={0.5}
        density={0.9}
        interaction="none"
        className="absolute inset-0 -z-10"
      />
      <h3 className="max-w-md text-3xl font-medium tracking-[-0.03em] text-balance">
        Ship it, then watch it rise
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">
        A height of 0.5 keeps the smoke in the lower half, under the copy.
      </p>
    </section>
  );
}
